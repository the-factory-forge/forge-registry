import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  AgentAttachmentStore,
  AgentFiles,
  AgentRecord,
  AgentRuntime,
  AgentServerOperation,
  AgentsStore,
  AgentStoredAttachment,
  AgentStoredAction,
} from "@/components/plugins/agents/server/types";
import {
  AgentsError,
  safeAgentResultHref,
  type AgentAttachment,
  type AgentConversation,
  type AgentEvent,
  type AgentMessage,
} from "@/components/plugins/agents/types";
import { storageFilename } from "@/components/utils/storage-filename";

const id = z.string().min(1).max(250);
const sendInput = z.object({
  conversationId: id,
  requestId: id,
  text: z.string().trim().max(32000),
  attachmentIds: z.array(id).max(10),
  resume: z.boolean().default(false),
});
const decisionInput = z.object({ conversationId: id, actionId: id, approve: z.boolean() });
const attachmentInput = z.object({
  conversationId: id,
  name: z.string().min(1).max(250),
  contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  bytes: z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.length > 0 && bytes.length <= 25 * 1024 * 1024),
});
const prefixSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/agents\/$/);
const message = (
  role: AgentMessage["role"],
  text: string,
  attachments: AgentAttachment[] = [],
): AgentMessage => ({ id: randomUUID(), role, text, attachments });
const metadata = ({ id, name, size, contentType }: AgentAttachment): AgentAttachment => ({
  id,
  name,
  size,
  contentType,
});
function actionMessage(action: AgentStoredAction, text: string): AgentMessage {
  return {
    ...message("tool", `${action.tool}: ${text}`),
    tool: { callId: action.callId, name: action.tool, input: action.input },
  };
}
export function agentSnapshot(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) => {
      if (item && typeof item === "object" && !Array.isArray(item))
        return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
      return item;
    }) ?? "null"
  );
}
function publicConversation(record: AgentRecord): AgentConversation {
  return {
    id: record.id,
    operationId: record.operationId,
    title: record.title,
    updatedAt: record.updatedAt,
    messages: record.messages,
    actions: record.actions.map(({ id, messageId, preview, status, result, resultHref }) => ({
      id,
      messageId,
      preview,
      status,
      result,
      resultHref,
    })),
    running: !!record.run,
    canResume: record.canResume,
  };
}
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AgentsError("INVALID");
  return result.data;
}
function toolResult(value: unknown): string {
  const text = JSON.stringify(value) ?? "null";
  return text.length > 128000
    ? `${text.slice(0, 128000)}\n[Result shortened; request a smaller selection.]`
    : text;
}

export interface AgentsServiceOptions<Context> {
  store: AgentsStore;
  runtime: AgentRuntime;
  operations: readonly AgentServerOperation<Context>[];
  /** Resolve a fresh staff session. Return null for customers, anonymous or disabled accounts. */
  actor(context: Context): Promise<{ id: string } | null>;
  attachments?: AgentAttachmentStore;
  /** Resolve a host route from a successful service result, never from model output. */
  resultHref?(
    context: Context,
    action: { operationId: string; tool: string; input: unknown; result: unknown },
  ): string | null | undefined;
}

export function createAgentsService<Context>(options: AgentsServiceOptions<Context>) {
  const { store, runtime } = options;
  const operations = new Map(options.operations.map((operation) => [operation.id, operation]));
  if (operations.size !== options.operations.length) throw new AgentsError("INVALID");
  for (const operation of operations.values()) {
    parse(id, operation.id);
    if (new Set(operation.tools.map((tool) => tool.name)).size !== operation.tools.length)
      throw new AgentsError("INVALID");
  }
  if (options.attachments) parse(prefixSchema, options.attachments.keyPrefix);
  async function owner(context: Context) {
    const actor = await options.actor(context);
    if (!actor) throw new AgentsError("FORBIDDEN");
    return parse(id, actor.id);
  }
  async function permit(context: Context, operationId: string) {
    const operation = operations.get(parse(id, operationId));
    if (!operation || !(await operation.authorize(context))) throw new AgentsError("FORBIDDEN");
    return operation;
  }
  async function access(context: Context, conversationId: string) {
    const ownerId = await owner(context);
    const record = await store.get(parse(id, conversationId), ownerId);
    if (!record) throw new AgentsError("NOT_FOUND");
    const operation = await permit(context, record.operationId);
    return { ownerId, operation, record };
  }
  function files(context: Context, conversationId: string): AgentFiles {
    return {
      async get(attachmentId) {
        const { ownerId, record } = await access(context, conversationId);
        if (record.deleting) throw new AgentsError("NOT_FOUND");
        const row = await store.getAttachment(parse(id, attachmentId), ownerId);
        if (!row || row.conversationId !== conversationId || row.state !== "ready")
          throw new AgentsError("NOT_FOUND");
        if (!options.attachments) throw new AgentsError("STORAGE");
        try {
          const bytes = await options.attachments.get(row.key);
          if (
            bytes.length !== row.size ||
            createHash("sha256").update(bytes).digest("hex") !== row.sha256
          )
            throw new AgentsError("STORAGE");
          return { metadata: metadata(row), bytes };
        } catch {
          throw new AgentsError("STORAGE");
        }
      },
    };
  }
  function change<T>(conversationId: string, ownerId: string, update: (record: AgentRecord) => T) {
    return store.change(conversationId, ownerId, (record) => {
      const result = update(record);
      record.updatedAt = new Date().toISOString();
      return result;
    });
  }
  async function get(context: Context, conversationId: string) {
    const { ownerId, record: current } = await access(context, conversationId);
    if (!current.run || Date.now() - Date.parse(current.run.startedAt) <= 120000)
      return publicConversation(current);
    return change(conversationId, ownerId, (record) => {
      // A lost request never licenses replay of a write that may already have reached its provider.
      if (record.run && Date.now() - Date.parse(record.run.startedAt) > 120000) {
        for (const action of record.actions)
          if (action.status === "executing") action.status = "unresolved";
        record.run = null;
        record.canResume = !record.actions.some((action) => action.status === "unresolved");
      }
      return publicConversation(record);
    });
  }
  async function cleanup(conversationId: string, ownerId: string) {
    const current = await store.get(conversationId, ownerId);
    for (const row of await store.attachments(conversationId, ownerId)) {
      if (row.state !== "cleanup" && !(row.state === "uploading" && current?.run?.id !== row.id))
        continue;
      if (!options.attachments) throw new AgentsError("STORAGE");
      try {
        await options.attachments.remove(row.key);
        await store.removeAttachment(row.id, ownerId);
      } catch {
        throw new AgentsError("STORAGE");
      }
    }
  }
  async function removeOwned(conversationId: string, ownerId: string) {
    await change(conversationId, ownerId, (record) => {
      if (record.run || record.actions.some((action) => action.status === "unresolved"))
        throw new AgentsError("BUSY");
      record.deleting = true;
      for (const action of record.actions)
        if (action.status === "pending") action.status = "rejected";
    });
    for (const row of await store.attachments(conversationId, ownerId))
      await store.putAttachment({ ...row, state: "cleanup" });
    await cleanup(conversationId, ownerId);
    await store.remove(conversationId, ownerId);
  }
  async function remove(context: Context, conversationId: string) {
    const { ownerId } = await access(context, conversationId);
    await removeOwned(conversationId, ownerId);
  }
  async function* send(
    context: Context,
    raw: unknown,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    const input = parse(sendInput, raw);
    const { ownerId, operation } = await access(context, input.conversationId);
    const conversationId = input.conversationId;
    const attachments: AgentAttachment[] = [];
    for (const attachmentId of input.attachmentIds)
      attachments.push((await files(context, conversationId).get(attachmentId)).metadata);
    const runId = randomUUID();
    const started = await change(conversationId, ownerId, (record) => {
      if (record.requests.includes(input.requestId)) return false;
      if (record.deleting) throw new AgentsError("NOT_FOUND");
      if (record.run) throw new AgentsError("BUSY");
      if (record.actions.some((action) => action.status === "pending"))
        throw new AgentsError("PENDING");
      if (record.actions.some((action) => action.status === "unresolved"))
        throw new AgentsError("UNRESOLVED");
      if (record.requests.length >= 1000) throw new AgentsError("LIMIT");
      if (input.resume) {
        if (!record.canResume || input.text || attachments.length) throw new AgentsError("INVALID");
      } else {
        if (!input.text && !attachments.length) throw new AgentsError("INVALID");
        record.messages.push(message("user", input.text, attachments));
        if (record.messages.length === 1)
          record.title = input.text.slice(0, 80) || attachments[0].name;
      }
      record.requests.push(input.requestId);
      record.run = { id: runId, startedAt: new Date().toISOString() };
      record.canResume = false;
      return true;
    });
    if (!started) {
      yield { type: "conversation", conversation: await get(context, conversationId) };
      return;
    }
    let partial = "";
    let completed = false;
    const checkRun = async () => {
      signal.throwIfAborted();
      const current = await access(context, conversationId);
      if (current.record.run?.id !== runId) throw new AgentsError("BUSY");
      if (current.record.actions.some((action) => action.status === "unresolved"))
        throw new AgentsError("UNRESOLVED");
      return current.record;
    };
    const flush = async () => {
      if (!partial) return;
      const text = partial;
      partial = "";
      await change(conversationId, ownerId, (record) => {
        if (record.run?.id !== runId) throw new AgentsError("BUSY");
        record.messages.push(message("assistant", text));
      });
    };
    try {
      yield { type: "conversation", conversation: await get(context, conversationId) };
      for (let step = 0; step < 12; step++) {
        const record = await checkRun();
        let called = false;
        for await (const event of runtime.stream({
          instructions: operation.instructions,
          messages: record.messages,
          tools: operation.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: z.toJSONSchema(tool.schema, { io: "input" }),
          })),
          signal,
        })) {
          await checkRun();
          if (event.type === "text") {
            if (typeof event.text !== "string" || partial.length + event.text.length > 128000)
              throw new AgentsError("LIMIT");
            partial += event.text;
            yield { type: "text", text: event.text };
            continue;
          }
          const tool = operation.tools.find((tool) => tool.name === event.name);
          if (!tool) throw new AgentsError("INVALID");
          const args = parse(tool.schema, event.input);
          const callId = parse(id, event.callId ?? randomUUID());
          await flush();
          if (tool.kind === "write") {
            const prepared = await tool.prepare(context, args, files(context, conversationId));
            await checkRun();
            await change(conversationId, ownerId, (current) => {
              if (current.run?.id !== runId) throw new AgentsError("BUSY");
              current.actions.push({
                id: randomUUID(),
                callId,
                messageId: current.messages.at(-1)!.id,
                tool: tool.name,
                input: args,
                preview: prepared.preview,
                snapshot: agentSnapshot(prepared.snapshot),
                status: "pending",
              });
            });
            completed = true;
            return;
          }
          const result = await tool.run(context, args, files(context, conversationId));
          await checkRun();
          await change(conversationId, ownerId, (current) => {
            if (current.run?.id !== runId) throw new AgentsError("BUSY");
            const entry = message("tool", `${tool.name}: ${toolResult(result)}`);
            entry.tool = { callId, name: tool.name, input: args };
            if (tool.download) {
              entry.download = true;
              current.downloads[entry.id] = { tool: tool.name, input: args };
            }
            current.messages.push(entry);
          });
          called = true;
          break;
        }
        await flush();
        if (!called) {
          completed = true;
          return;
        }
      }
      throw new AgentsError("LIMIT");
    } catch (error) {
      if (signal.aborted) return;
      throw error instanceof AgentsError ? error : new AgentsError("RUNTIME");
    } finally {
      await flush();
      await change(conversationId, ownerId, (record) => {
        if (record.run?.id === runId) {
          record.run = null;
          record.canResume = !completed;
        }
      });
      // Async-generator return skips further yields; the client reloads durable state on completion.
    }
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
      if (!tool || tool.kind !== "write") throw new AgentsError("STALE");
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
  async function attach(context: Context, raw: unknown) {
    const input = parse(attachmentInput, raw);
    const { ownerId } = await access(context, input.conversationId);
    const attachmentStore = options.attachments;
    if (!attachmentStore) throw new AgentsError("STORAGE");
    const attachmentId = randomUUID();
    await change(input.conversationId, ownerId, (record) => {
      if (record.deleting) throw new AgentsError("NOT_FOUND");
      if (record.run) throw new AgentsError("BUSY");
      record.run = { id: attachmentId, startedAt: new Date().toISOString() };
    });
    const extension =
      input.name
        .split(".")
        .at(-1)
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase() || "bin";
    const row: AgentStoredAttachment = {
      id: attachmentId,
      ownerId,
      conversationId: input.conversationId,
      name: input.name,
      contentType: input.contentType,
      size: input.bytes.length,
      key: `${attachmentStore.keyPrefix}${input.conversationId}/${attachmentId}/${storageFilename(input.name, "attachment", extension)}`,
      state: "uploading",
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    };
    try {
      await store.putAttachment(row);
      await attachmentStore.put(row.key, input.bytes, input.contentType);
      const current = await access(context, input.conversationId);
      if (current.record.deleting || current.record.run?.id !== attachmentId)
        throw new AgentsError("BUSY");
      await store.putAttachment({ ...row, state: "ready" });
      return metadata(row);
    } catch {
      await store.putAttachment({ ...row, state: "cleanup" });
      await cleanup(input.conversationId, ownerId).catch(() => {});
      throw new AgentsError("STORAGE");
    } finally {
      await change(input.conversationId, ownerId, (record) => {
        if (record.run?.id === attachmentId) record.run = null;
      });
    }
  }
  return {
    client(context: Context) {
      return {
        async operations() {
          await owner(context);
          const allowed = await Promise.all(
            options.operations.map(async (operation) =>
              (await operation.authorize(context))
                ? {
                    id: operation.id,
                    label: operation.label,
                    description: operation.description,
                    attachmentOptions: operation.attachmentOptions,
                  }
                : null,
            ),
          );
          return allowed.filter((operation) => operation !== null);
        },
        async list(operationId: string) {
          const ownerId = await owner(context);
          await permit(context, operationId);
          return (await store.list(ownerId, operationId)).map(
            ({ id, title, operationId, updatedAt }) => ({ id, title, operationId, updatedAt }),
          );
        },
        async create(operationId: string) {
          const ownerId = await owner(context);
          await permit(context, operationId);
          const record: AgentRecord = {
            id: randomUUID(),
            ownerId,
            operationId,
            title: "",
            updatedAt: new Date().toISOString(),
            messages: [],
            actions: [],
            run: null,
            requests: [],
            downloads: {},
            canResume: false,
          };
          await store.create(record);
          return publicConversation(record);
        },
        get: (conversationId: string) => get(context, conversationId),
        send: (input: unknown, signal: AbortSignal) => send(context, input, signal),
        decide: (input: unknown) => decide(context, input),
        remove: (conversationId: string) => remove(context, conversationId),
        attach: (input: unknown) => attach(context, input),
        attachment: (conversationId: string, attachmentId: string) =>
          files(context, conversationId).get(attachmentId),
        async download(conversationId: string, messageId: string) {
          const { record, operation } = await access(context, conversationId);
          const download = record.downloads[parse(id, messageId)];
          const tool = download && operation.tools.find((tool) => tool.name === download.tool);
          if (!tool || tool.kind !== "read" || !tool.download) throw new AgentsError("NOT_FOUND");
          return tool.download(context, parse(tool.schema, download.input));
        },
        async cleanup(conversationId: string) {
          const { ownerId } = await access(context, conversationId);
          await cleanup(conversationId, ownerId);
        },
      };
    },
    /** Trusted account-deletion hook. Disable the account first and reconcile in-flight writes. */
    async removeOwner(ownerId: string) {
      parse(id, ownerId);
      for (;;) {
        const ids = await store.owned(ownerId);
        if (!ids.length) return;
        for (const conversationId of ids) await removeOwned(conversationId, ownerId);
      }
    },
    /** Trusted host reconciliation only: verify the actual plugin state before supplying the result. */
    async reconcile(ownerId: string, conversationId: string, actionId: string, result: string) {
      await change(parse(id, conversationId), parse(id, ownerId), (record) => {
        const action = record.actions.find((action) => action.id === actionId);
        if (!action || action.status !== "unresolved") throw new AgentsError("INVALID");
        action.status = "succeeded";
        action.result = result;
        const existing = record.messages.findLast((entry) => entry.tool?.callId === action.callId);
        if (existing) existing.text = `${action.tool}: Host reconciliation: ${result}`;
        else record.messages.push(actionMessage(action, `Host reconciliation: ${result}`));
        record.canResume = true;
      });
    },
  };
}
