import "../drive-storage/register.mjs";
import { randomUUID } from "node:crypto";

import { z } from "zod";

const { createAgentsService } =
  await import("../../registry/components/plugins/agents/server/service.server.ts");
const { agentTools } = await import("../../registry/components/plugins/agents/server/tools.ts");

export function memoryStore() {
  const records = new Map();
  const attachments = new Map();
  return {
    records,
    attachmentRecords: attachments,
    async create(record) {
      if (!records.has(record.id)) records.set(record.id, structuredClone(record));
    },
    async get(id, ownerId) {
      const record = records.get(id);
      return record?.ownerId === ownerId ? structuredClone(record) : null;
    },
    async list(ownerId, operationId) {
      return structuredClone(
        [...records.values()].filter(
          (row) => row.ownerId === ownerId && row.operationId === operationId && !row.connection,
        ),
      );
    },
    async owned(ownerId) {
      return [...records.values()].filter((row) => row.ownerId === ownerId).map((row) => row.id);
    },
    async change(id, ownerId, update) {
      const original = records.get(id);
      if (!original || original.ownerId !== ownerId)
        throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      const record = structuredClone(original);
      const result = update(record);
      records.set(id, record);
      return structuredClone(result);
    },
    async remove(id, ownerId) {
      if (records.get(id)?.ownerId === ownerId) records.delete(id);
    },
    async putAttachment(row) {
      attachments.set(row.id, structuredClone(row));
    },
    async getAttachment(id, ownerId) {
      const row = attachments.get(id);
      return row?.ownerId === ownerId ? structuredClone(row) : null;
    },
    async attachments(conversationId, ownerId) {
      return structuredClone(
        [...attachments.values()].filter(
          (row) => row.conversationId === conversationId && row.ownerId === ownerId,
        ),
      );
    },
    async removeAttachment(id, ownerId) {
      if (attachments.get(id)?.ownerId === ownerId) attachments.delete(id);
    },
  };
}
export function fixture(overrides = {}) {
  const store = memoryStore();
  const objects = new Map();
  const state = {
    value: "before",
    reads: 0,
    writes: 0,
    allowed: true,
    failWrite: false,
    failCleanup: false,
    runtimeInputs: [],
  };
  const { read, write } = agentTools();
  const operation = {
    id: "blogs",
    label: "Blogs",
    description: "Blog tasks",
    instructions: "Trusted host instructions.",
    authorize: async () => state.allowed,
    tools: [
      read("get", z.object({}), async () => {
        state.reads++;
        return { value: state.value };
      }),
      write("save", z.object({ value: z.string() }), {
        before: async () => ({ value: state.value }),
        run: async (_c, input) => {
          state.writes++;
          if (state.failWrite) throw new Error("provider timeout");
          state.value = input.value;
          return { value: state.value };
        },
      }),
    ],
  };
  const runtime = {
    async *stream(input) {
      state.runtimeInputs.push(input);
      const last = input.messages.at(-1);
      if (last.role === "tool") {
        yield { type: "text", text: "Done." };
        return;
      }
      if (last.text === "read") yield { type: "tool", name: "get", input: {} };
      else if (last.text === "invalid") yield { type: "tool", name: "save", input: { value: 42 } };
      else if (last.text === "unknown") yield { type: "tool", name: "unregistered", input: {} };
      else {
        yield { type: "text", text: "Proposed update." };
        yield { type: "tool", name: "save", input: { value: last.text, ignored: "strip me" } };
      }
    },
  };
  const service = createAgentsService({
    store,
    runtime,
    operations: [operation],
    actor: async (context) => (context === "visitor" ? null : { id: context }),
    attachments: {
      keyPrefix: "test/agents/",
      put: async (key, bytes) => {
        objects.set(key, new Uint8Array(bytes));
      },
      get: async (key) => {
        if (!objects.has(key)) throw new Error("Missing");
        return objects.get(key);
      },
      remove: async (key) => {
        if (state.failCleanup) throw new Error("storage offline");
        objects.delete(key);
      },
    },
    ...overrides,
  });
  const client = service.client("staff");
  return {
    service,
    client,
    store,
    objects,
    state,
    operation,
    async create() {
      return client.create("blogs");
    },
  };
}
export async function send(client, conversationId, text, extra = {}) {
  const events = [];
  for await (const event of client.send(
    { conversationId, requestId: randomUUID(), text, attachmentIds: [], ...extra },
    new AbortController().signal,
  ))
    events.push(event);
  return { events, chat: await client.get(conversationId) };
}
