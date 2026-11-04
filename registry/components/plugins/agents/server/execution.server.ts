import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  AgentFiles,
  AgentRecord,
  AgentServerOperation,
  AgentStoredAction,
  AgentTool,
} from "@/components/plugins/agents/server/types";
import {
  AgentsError,
  safeAgentResultHref,
  type AgentConversation,
  type AgentMessage,
} from "@/components/plugins/agents/types";

const id = z.string().min(1).max(250);
const decisionInput = z.object({ conversationId: id, actionId: id, approve: z.boolean() });
export function agentSnapshot(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) => {
      if (item && typeof item === "object" && !Array.isArray(item))
        return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
      return item;
    }) ?? "null"
  );
}
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AgentsError("INVALID");
  return result.data;
}
export function toolResult(value: unknown): string {
  const text = JSON.stringify(value) ?? "null";
  return text.length > 128000
    ? `${text.slice(0, 128000)}\n[Result shortened; request a smaller selection.]`
    : text;
}

export function actionMessage(action: AgentStoredAction, text: string): AgentMessage {
  return {
    id: randomUUID(),
    role: "tool",
    text: `${action.tool}: ${text}`,
    attachments: [],
    tool: { callId: action.callId, name: action.tool, input: action.input },
  };
}

interface ExecutionOptions<Context> {
  access(
    this: void,
    context: Context,
    conversationId: string,
  ): Promise<{ ownerId: string; operation: AgentServerOperation<Context>; record: AgentRecord }>;
  change<T>(
    this: void,
    conversationId: string,
    ownerId: string,
    update: (record: AgentRecord) => T,
  ): Promise<T>;
  get(this: void, context: Context, conversationId: string): Promise<AgentConversation>;
  files(this: void, context: Context, conversationId: string): AgentFiles;
  resultHref?(
    context: Context,
    action: { operationId: string; tool: string; input: unknown; result: unknown },
  ): string | null | undefined;
}

/** Both chat and MCP cross this seam; only prepared, stored arguments can execute. */
export function createAgentExecutor<Context>(options: ExecutionOptions<Context>) {
  const { access, change, get, files } = options;
  async function read(context: Context, tool: AgentTool<Context>, raw: unknown, files: AgentFiles) {
    if (tool.kind !== "read") throw new AgentsError("INVALID");
    return tool.run(context, parse(tool.schema, raw), files);
  }
  async function prepare(
    context: Context,
    tool: AgentTool<Context>,
    raw: unknown,
    files: AgentFiles,
    messageId: string,
    callId: string,
  ): Promise<AgentStoredAction> {
    if (tool.kind !== "write") throw new AgentsError("INVALID");
    const input = parse(tool.schema, raw);
    const prepared = await tool.prepare(context, input, files);
    return {
      id: randomUUID(),
      callId,
      messageId,
      tool: tool.name,
      input,
      preview: prepared.preview,
      snapshot: agentSnapshot(prepared.snapshot),
      status: "pending",
    };
  }
  async function decide(context: Context, raw: unknown) {
    const input = parse(decisionInput, raw);
    const { ownerId, operation } = await access(context, input.conversationId);
    const runId = randomUUID();
    const action = await change(input.conversationId, ownerId, (record) => {
      const action = record.actions.find((candidate) => candidate.id === input.actionId);
      if (record.deleting) throw new AgentsError("NOT_FOUND");
      if (!action) throw new AgentsError("NOT_FOUND");
      if (action.status !== "pending") return null;
      if (record.run) throw new AgentsError("BUSY");
      if (!input.approve) {
        action.status = "rejected";
        record.messages.push(actionMessage(action, "User rejected this action."));
        record.canResume = true;
        return null;
      }
      action.status = "executing";
      record.run = { id: runId, startedAt: new Date().toISOString() };
      return structuredClone(action);
    });
    if (!action) return get(context, input.conversationId);
    const tool = operation.tools.find((tool) => tool.name === action.tool);
    let started = false;
    try {
      if (
        !tool ||
        tool.kind !== "write" ||
        (action.expiresAt && Date.parse(action.expiresAt) <= Date.now())
      )
        throw new AgentsError("STALE");
      const args = parse(tool.schema, action.input);
      const prepared = await tool.prepare(context, args, files(context, input.conversationId));
      if (
        agentSnapshot(prepared.snapshot) !== action.snapshot ||
        agentSnapshot(prepared.preview) !== agentSnapshot(action.preview)
      )
        throw new AgentsError("STALE");
      const current = await access(context, input.conversationId);
      if (current.record.run?.id !== runId) throw new AgentsError("BUSY");
      started = true;
      const result = await tool.run(
        context,
        args,
        files(context, input.conversationId),
        action.id,
        prepared.snapshot,
      );
      let resultHref: string | undefined;
      try {
        resultHref = safeAgentResultHref(
          options.resultHref?.(context, {
            operationId: operation.id,
            tool: tool.name,
            input: args,
            result,
          }),
        );
      } catch {
        // A navigation failure must not make a completed write retryable.
      }
      await change(input.conversationId, ownerId, (record) => {
        const saved = record.actions.find((candidate) => candidate.id === action.id)!;
        if (record.run?.id !== runId) {
          saved.status = "unresolved";
          saved.result =
            "A late execution completed after request recovery. Verify the plugin state again.";
          record.canResume = false;
          return;
        }
        saved.status = "succeeded";
        saved.result = toolResult(result);
        saved.resultHref = resultHref;
        record.messages.push(actionMessage(saved, saved.result));
        record.run = null;
        record.canResume = true;
      });
    } catch (error) {
      await change(input.conversationId, ownerId, (record) => {
        const saved = record.actions.find((candidate) => candidate.id === action.id)!;
        if (record.run?.id !== runId) {
          saved.status = "unresolved";
          record.canResume = false;
          return;
        }
        const uncertain = started;
        saved.status = uncertain ? "unresolved" : "stale";
        record.run = null;
        record.canResume = !uncertain;
        record.messages.push(
          actionMessage(
            action,
            uncertain
              ? "Outcome unknown. Reconcile in the host before continuing."
              : "Proposal expired, validation failed or access changed. Prepare a new proposal.",
          ),
        );
      });
      if (error instanceof AgentsError && error.code === "FORBIDDEN") throw error;
    }
    return get(context, input.conversationId);
  }
  return { read, prepare, decide };
}
