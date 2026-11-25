import { z } from "zod";

import type {
  AgentsWebMcpClient,
  WebMcpProposal,
  WebMcpToolDefinition,
} from "@/components/connectors/agents-webmcp/types";
import {
  agentSnapshot,
  createAgentExecutor,
  parse,
  toolResult,
} from "@/components/plugins/agents/execution";
import type {
  AgentFiles,
  AgentRecord,
  AgentServerOperation,
} from "@/components/plugins/agents/server/types";
import { AgentsError } from "@/components/plugins/agents/types";

export type PreviewOperation = AgentServerOperation<undefined>;
const id = z.string().min(1).max(250);
const writeInput = z.object({ input: z.unknown(), requestId: id }).strict();
const stageInput = z
  .object({
    operationId: id,
    requestId: id,
    name: id,
    contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
    base64: z
      .string()
      .min(4)
      .max(699052)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict();

/** Disposable showroom records; production identity and persistence stay on the host server. */
export function createPluginAgentClient(
  operations: () => readonly PreviewOperation[],
): AgentsWebMcpClient {
  const records = new Map<string, AgentRecord>();
  const requests = new Map<
    string,
    { fingerprint: string; proposalId: string; ready: Promise<void> }
  >();
  const attachments = new Map<
    string,
    Awaited<ReturnType<AgentFiles["get"]>> & { operationId: string }
  >();
  const stages = new Map<string, { fingerprint: string; attachmentId: string }>();
  async function operationFor(operationId: string) {
    const operation = operations().find((item) => item.id === operationId);
    if (!operation || !(await operation.authorize(undefined))) throw new AgentsError("FORBIDDEN");
    return operation;
  }
  async function toolFor(name: string) {
    for (const operation of operations()) {
      const tool = operation.tools.find((item) => item.name === name);
      if (!tool) continue;
      await operationFor(operation.id);
      if (tool.authorize && !(await tool.authorize(undefined))) throw new AgentsError("FORBIDDEN");
      return { operation, tool };
    }
    throw new AgentsError("INVALID");
  }
  function files(operationId: string): AgentFiles {
    return {
      async get(id) {
        await operationFor(operationId);
        const value = attachments.get(id);
        if (!value || value.operationId !== operationId) throw new AgentsError("NOT_FOUND");
        return structuredClone(value);
      },
    };
  }
  async function access(_context: undefined, conversationId: string) {
    const record = records.get(conversationId);
    if (!record) throw new AgentsError("NOT_FOUND");
    return { record, ownerId: record.ownerId, operation: await operationFor(record.operationId) };
  }
  const executor = createAgentExecutor<undefined>({
    access,
    async change<T>(conversationId: string, _ownerId: string, update: (record: AgentRecord) => T) {
      const current = records.get(conversationId);
      if (!current) throw new AgentsError("NOT_FOUND");
      const record = structuredClone(current);
      const result = update(record);
      records.set(conversationId, record);
      return structuredClone(result);
    },
    async get(context, conversationId) {
      const { record } = await access(context, conversationId);
      return { ...structuredClone(record), running: !!record.run };
    },
    files: (_context, conversationId) => files(records.get(conversationId)!.operationId),
  });
  async function proposal(proposalId: string): Promise<WebMcpProposal> {
    const { record } = await access(undefined, proposalId);
    const { id, messageId, preview, status, result, resultHref } = record.actions[0];
    return structuredClone({
      id,
      messageId,
      preview,
      status,
      result,
      resultHref,
      proposalId,
      operationId: record.operationId,
    });
  }
  return {
    async catalog() {
      const catalog: WebMcpToolDefinition[] = [];
      for (const operation of operations()) {
        if (!(await operation.authorize(undefined))) continue;
        for (const tool of operation.tools) {
          if (tool.authorize && !(await tool.authorize(undefined))) continue;
          catalog.push({
            name: tool.name,
            kind: tool.kind,
            description: `${tool.description} in ${operation.label}. Sample data only. operationId: ${operation.id}.${tool.kind === "write" ? " Wait for approval in the page." : ""}`,
            schema: JSON.stringify(
              z.toJSONSchema(
                tool.kind === "write" ? writeInput.extend({ input: tool.schema }) : tool.schema,
                { io: "input" },
              ),
            ),
          });
        }
      }
      if (
        operations().some((op) =>
          op.tools.some((t) => t.requiresAttachments && catalog.some((c) => c.name === t.name)),
        )
      )
        catalog.push({
          name: "webmcp_stage_file",
          kind: "staging" as const,
          description:
            "Stage a sample file up to 512 KiB for an upload proposal. Nothing leaves this tab.",
          schema: JSON.stringify(z.toJSONSchema(stageInput)),
        });
      return catalog;
    },
    async call(name, raw, signal) {
      signal?.throwIfAborted();
      if (name === "webmcp_stage_file") {
        const input = parse(stageInput, raw);
        const operation = await operationFor(input.operationId);
        const allowed = await Promise.all(
          operation.tools
            .filter((t) => t.requiresAttachments)
            .map(async (t) => !t.authorize || (await t.authorize(undefined))),
        );
        if (!allowed.some(Boolean)) throw new AgentsError("FORBIDDEN");
        const fingerprint = agentSnapshot(input);
        const previous = stages.get(input.requestId);
        if (previous && previous.fingerprint !== fingerprint) throw new AgentsError("INVALID");
        if (previous)
          return {
            kind: "result",
            value: toolResult(attachments.get(previous.attachmentId)!.metadata),
          };
        const bytes = Uint8Array.from(atob(input.base64), (char) => char.charCodeAt(0));
        if (!bytes.length || bytes.length > 512 * 1024) throw new AgentsError("LIMIT");
        const metadata = {
          id: crypto.randomUUID(),
          name: input.name,
          contentType: input.contentType,
          size: bytes.length,
        };
        attachments.set(metadata.id, { bytes, metadata, operationId: input.operationId });
        stages.set(input.requestId, { fingerprint, attachmentId: metadata.id });
        return { kind: "result", value: toolResult(metadata) };
      }
      const { operation, tool } = await toolFor(name);
      if (tool.kind === "read")
        return {
          kind: "result",
          value: toolResult(await executor.read(undefined, tool, raw, files(operation.id))),
        };
      const input = parse(writeInput, raw);
      const fingerprint = agentSnapshot({
        operation: operation.id,
        tool: name,
        input: input.input,
      });
      const previous = requests.get(input.requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new AgentsError("INVALID");
        await previous.ready;
        return { kind: "proposal", value: await proposal(previous.proposalId) };
      }
      const proposalId = crypto.randomUUID();
      const ready = Promise.resolve().then(async () => {
        const action = await executor.prepare(
          undefined,
          tool,
          input.input,
          files(operation.id),
          crypto.randomUUID(),
          input.requestId,
        );
        signal?.throwIfAborted();
        action.expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        records.set(
          proposalId,
          structuredClone({
            id: proposalId,
            ownerId: "showroom",
            operationId: operation.id,
            title: action.preview.title,
            updatedAt: new Date().toISOString(),
            actions: [action],
            messages: [],
            requests: [input.requestId],
            downloads: {},
            run: null,
            canResume: false,
          }),
        );
      });
      requests.set(input.requestId, { fingerprint, proposalId, ready });
      try {
        await ready;
      } catch (error) {
        requests.delete(input.requestId);
        throw error;
      }
      return { kind: "proposal", value: await proposal(proposalId) };
    },
    proposal,
    async decide(input) {
      const current = await proposal(input.proposalId);
      if (agentSnapshot(current.preview) !== agentSnapshot(input.review))
        throw new AgentsError("INVALID");
      await executor.decide(undefined, {
        conversationId: input.proposalId,
        actionId: current.id,
        approve: input.approve,
      });
      return proposal(input.proposalId);
    },
  };
}
