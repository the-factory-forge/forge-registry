import assert from "node:assert/strict";
import test from "node:test";

import { fixture } from "./agents/fixture.mjs";
const { createAgentsService } =
  await import("../registry/components/plugins/agents/server/service.server.ts");
const { createAgentsMcpHandler } =
  await import("../registry/components/plugins/agents/server/mcp.server.ts");

function external(overrides = {}) {
  const f = fixture();
  const identity = {
    id: "staff",
    connection: { id: "grant", clientId: "claude" },
    scopes: ["agents:blogs:read", "agents:blogs:write"],
  };
  let active = true;
  const options = {
    store: f.store,
    operations: [f.operation],
    actor: async () => (active ? identity : null),
    ...overrides,
  };
  const service = createAgentsService(options);
  const client = service.external({});
  const mcp = createAgentsMcpHandler({ ...options, resource: "https://intranet.example/api/mcp" });
  async function rpc(method, params = {}, origin, connection) {
    const response = await mcp.handle(
      new Request("https://intranet.example/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
          ...(origin ? { Origin: origin } : {}),
          ...(connection ? { Connection: connection } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
      {},
    );
    const text = await response.text();
    const data = text.startsWith("event:")
      ? JSON.parse(
          text
            .split("\n")
            .find((line) => line.startsWith("data: "))
            .slice(6),
        )
      : JSON.parse(text);
    return { response, data };
  }
  return {
    ...f,
    identity,
    service,
    client,
    mcp,
    rpc,
    revoke() {
      active = false;
    },
  };
}

await test("MCP SSE leaves connection lifetime to the HTTP server", async () => {
  const f = external();
  for (const connection of ["close", "keep-alive"]) {
    for (let call = 0; call < 4; call++) {
      const { response, data } = await f.rpc("ping", {}, undefined, connection);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("connection"), null);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(data.result, {});
    }
  }
});

await test("external proposals need no runtime; reviews bind the exact arguments and retries never replay", async () => {
  const f = external();
  const p = await f.client.propose("blogs", "save", { value: "after", ignored: true }, "request");
  assert.equal(f.state.writes, 0);
  const duplicate = await f.client.propose("blogs", "save", { value: "after" }, "request");
  assert.equal(duplicate.id, p.id);
  await assert.rejects(f.client.propose("blogs", "save", { value: "changed" }, "request"), {
    code: "INVALID",
  });
  await assert.rejects(
    f.client.decide({
      proposalId: p.proposalId,
      approve: true,
      review: { ...p.preview, target: "forged" },
    }),
    { code: "INVALID" },
  );
  const decision = { proposalId: p.proposalId, approve: true, review: p.preview };
  const done = await f.client.decide(decision);
  await f.client.decide(decision);
  assert.equal(done.status, "succeeded");
  assert.equal(f.state.writes, 1);
  assert.deepEqual(await f.client.read("blogs", "get", {}), { value: "after" });
  assert.deepEqual(await fixture({ store: f.store }).client.list("blogs"), []);
});

await test("MCP preserves compatible plugin errors without exposing private diagnostics", async () => {
  for (const code of ["NOT_FOUND", "FORBIDDEN", "INVALID", "STORAGE", "DATABASE_INTERNAL"]) {
    const f = external();
    const fail = async () => {
      throw Object.assign(new Error("private database details"), { code });
    };
    f.operation.tools[0].run = fail;
    f.operation.tools[1].prepare = fail;
    for (const [name, args] of [
      ["get", {}],
      ["save", { input: { value: "change" }, requestId: "failed-proposal" }],
    ]) {
      const { data } = await f.rpc("tools/call", { name, arguments: args });
      assert.deepEqual(data.result, {
        isError: true,
        content: [{ type: "text", text: code === "DATABASE_INTERNAL" ? "RUNTIME" : code }],
      });
    }
    assert.equal(f.state.writes, 0);
  }
});

await test("external records are isolated from other grants, owners and intranet chat", async () => {
  const f = external();
  const p = await f.client.propose("blogs", "save", { value: "after" }, "request");
  await assert.rejects(f.service.client({}).create("blogs"), { code: "FORBIDDEN" });
  await assert.rejects(fixture({ store: f.store }).client.get(p.proposalId), { code: "NOT_FOUND" });
  f.identity.connection.id = "other-grant";
  await assert.rejects(f.client.proposal(p.proposalId), { code: "NOT_FOUND" });
  f.identity.connection.id = "grant";
  f.identity.id = "other-user";
  await assert.rejects(f.client.proposal(p.proposalId), { code: "NOT_FOUND" });
  f.revoke();
  await assert.rejects(f.client.read("blogs", "get", {}), { code: "FORBIDDEN" });
});

await test("stale, expired, rejected and uncertain external proposals retain existing recovery rules", async () => {
  for (const scenario of ["stale", "expired", "rejected", "unresolved"]) {
    const f = external();
    const p = await f.client.propose("blogs", "save", { value: "after" }, "request");
    if (scenario === "stale") f.state.value = "someone edited it";
    if (scenario === "expired")
      f.store.records.get(p.proposalId).actions[0].expiresAt = new Date(0).toISOString();
    if (scenario === "unresolved") f.state.failWrite = true;
    const decision = {
      proposalId: p.proposalId,
      approve: scenario !== "rejected",
      review: p.preview,
    };
    const result = await f.client.decide(decision);
    assert.equal(result.status, scenario === "expired" ? "stale" : scenario);
    await f.client.decide(decision);
    assert.equal(f.state.writes, scenario === "unresolved" ? 1 : 0);
  }
});

await test("MCP exposes scoped tools, validates calls, prepares and executes through the shared engine", async () => {
  const f = external();
  const { data: list, response } = await f.rpc("tools/list");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(list.result.tools.some((t) => t.name === "get" && t.annotations.readOnlyHint));
  assert.equal(
    list.result.tools.find((t) => t.name === "agents_execute").annotations.readOnlyHint,
    false,
  );
  const { data: prepared } = await f.rpc("tools/call", {
    name: "save",
    arguments: { input: { value: "after" }, requestId: "request" },
  });
  assert.equal(prepared.result.isError, undefined);
  const proposal = JSON.parse(prepared.result.content[0].text);
  f.identity.scopes = ["agents:blogs:read"];
  const { data: denied } = await f.rpc("tools/call", {
    name: "agents_execute",
    arguments: { proposalId: proposal.proposalId, review: proposal.preview },
  });
  assert.equal(denied.result.isError, true);
  assert.equal(f.state.writes, 0);
  const { data: restricted } = await f.rpc("tools/list");
  assert.ok(!restricted.result.tools.some((t) => t.name === "save"));
  f.state.allowed = false;
  const { data: unavailable } = await f.rpc("tools/list");
  assert.ok(!unavailable.result.tools.some((t) => t.name === "get"));
});

await test("MCP rejects a foreign browser origin and absent authentication", async () => {
  const f = external();
  const request = () =>
    new Request("https://intranet.example/api/mcp", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    });
  assert.equal((await f.mcp.handle(request(), {})).status, 403);
  f.revoke();
  assert.equal(
    (await f.mcp.handle(new Request("https://intranet.example/api/mcp"), {})).status,
    401,
  );
});

await test("conversation tools cannot bypass target-operation scopes through a saved chat", async () => {
  const { send, memoryStore } = await import("./agents/fixture.mjs");
  const { createAgentConversationsOperation } =
    await import("../registry/components/connectors/agents-conversations/server/index.ts");
  const f = fixture();
  const chat = await f.client.create("blogs");
  const pending = await send(f.client, chat.id, "change");
  const actionId = pending.chat.actions[0].id;
  const identity = {
    id: "staff",
    connection: { id: "nested", clientId: "inspector" },
    scopes: ["agents:agents:read", "agents:agents:write"],
  };
  const operation = createAgentConversationsOperation({
    authorize: async () => true,
    client: () => f.client,
    authorizeOperation: async (c, id, kind) => c.scopes.includes(`agents:${id}:${kind}`),
  });
  const handler = createAgentsMcpHandler({
    resource: "https://fixture.test/mcp",
    store: memoryStore(),
    operations: [operation],
    actor: async (c) => c,
  });
  async function call(name, args) {
    const response = await handler.handle(
      new Request("https://fixture.test/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args },
        }),
      }),
      identity,
    );
    const text = await response.text();
    return JSON.parse(
      text.startsWith("event:")
        ? text
            .split("\n")
            .find((l) => l.startsWith("data: "))
            .slice(6)
        : text,
    ).result;
  }
  assert.deepEqual(JSON.parse((await call("conversations_operations", {})).content[0].text), []);
  assert.equal((await call("conversations_list", { operationId: "blogs" })).isError, true);
  assert.equal((await call("conversations_get", { conversationId: chat.id })).isError, true);
  const input = {
    input: { conversationId: chat.id, actionId, approve: true },
    requestId: "denied",
  };
  assert.equal((await call("conversations_decide", input)).isError, true);
  identity.scopes.push("agents:blogs:read");
  assert.equal((await call("conversations_decide", input)).isError, true);
  identity.scopes.push("agents:blogs:write");
  const prepared = await call("conversations_decide", { ...input, requestId: "allowed" });
  assert.ok(!prepared.isError);
  const p = JSON.parse(prepared.content[0].text);
  identity.scopes.pop();
  const result = await call("agents_execute", { proposalId: p.proposalId, review: p.preview });
  assert.equal(result.isError, true);
  assert.equal(f.state.writes, 0);
});

await test("MCP preserves conversations_decide attachment reviews for approval and rejection", async () => {
  const { z } = await import("zod");
  const { send } = await import("./agents/fixture.mjs");
  const { agentTools } = await import("../registry/components/plugins/agents/server/tools.ts");
  const { createAgentConversationsOperation } =
    await import("../registry/components/connectors/agents-conversations/server/index.ts");
  const { write } = agentTools();

  for (const [decision, approve, expected] of [
    ["agents_execute", true, "succeeded"],
    ["agents_execute", false, "rejected"],
    ["agents_reject", true, "pending"],
  ]) {
    let attachmentId;
    let writes = 0;
    const operation = {
      id: "blogs",
      label: "Blogs",
      instructions: "Use the supplied file.",
      authorize: async () => true,
      tools: [
        write("deposit", z.object({ attachmentId: z.string() }), {
          before: async () => null,
          attachments: (input) => [input.attachmentId],
          run: async () => {
            writes++;
            return "File deposited.";
          },
        }),
      ],
    };
    const f = fixture({
      operations: [operation],
      runtime: {
        async *stream() {
          yield { type: "tool", name: "deposit", input: { attachmentId } };
        },
      },
    });
    const chat = await f.create();
    const file = await f.client.attach({
      conversationId: chat.id,
      name: "review.txt",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("File to review"),
    });
    attachmentId = file.id;
    const pending = await send(f.client, chat.id, "deposit", { attachmentIds: [file.id] });
    const action = pending.chat.actions[0];
    assert.deepEqual(action.preview.attachments, [file]);

    const remote = external({
      operations: [
        createAgentConversationsOperation({
          authorize: async () => true,
          client: () => f.client,
          authorizeOperation: async (_context, id, kind) =>
            remote.identity.scopes.includes(`agents:${id}:${kind}`),
        }),
      ],
    });
    remote.identity.scopes.push("agents:agents:read", "agents:agents:write");
    const call = async (name, args) =>
      (await remote.rpc("tools/call", { name, arguments: args })).data.result;
    const prepared = await call("conversations_decide", {
      input: { conversationId: chat.id, actionId: action.id, approve },
      requestId: "review-file",
    });
    assert.ok(!prepared.isError, JSON.stringify(prepared));
    const proposal = JSON.parse(prepared.content[0].text);
    assert.deepEqual(proposal.preview.attachments, [file]);
    assert.equal((await f.client.get(chat.id)).actions[0].status, "pending");
    assert.equal(writes, 0);

    const changed = structuredClone(proposal.preview);
    changed.attachments[0].name = "different.txt";
    const invalid = await call(decision, { proposalId: proposal.proposalId, review: changed });
    assert.equal(invalid.isError, true);
    assert.equal(invalid.content[0].text, "INVALID");
    assert.equal(writes, 0);

    const input = { proposalId: proposal.proposalId, review: proposal.preview };
    const result = await call(decision, input);
    assert.ok(!result.isError, JSON.stringify(result));
    assert.equal(
      JSON.parse(result.content[0].text).status,
      decision === "agents_reject" ? "rejected" : "succeeded",
    );
    assert.deepEqual(await call(decision, input), result);
    assert.equal((await f.client.get(chat.id)).actions[0].status, expected);
    assert.equal(writes, expected === "succeeded" ? 1 : 0);
  }
});

await test("MCP stages private bytes, reviews a Drive upload and reads consistent chunks", async () => {
  const { createDriveAgentOperation } =
    await import("../registry/components/connectors/agents-drive/server/index.ts");
  const objects = new Map();
  let uploaded;
  let allowed = true;
  let uploads = 0;
  const operation = createDriveAgentOperation({
    authorize: async () => true,
    entry: async () => ({ id: "file", name: "check.bin", state: "ready", kind: "file" }),
    client: () => ({
      prepareUpload: async () => ({ id: "upload" }),
      completeUpload: async () => {
        uploads++;
      },
    }),
    transferUpload: async (_ticket, file) => {
      uploaded = new Uint8Array(await file.arrayBuffer());
    },
    readFile: async () => ({
      name: "check.bin",
      contentType: "application/octet-stream",
      bytes: uploaded,
    }),
  });
  operation.tools.find((tool) => tool.name === "drive_upload").authorize = async () => allowed;
  const f = external({
    operations: [operation],
    attachments: {
      keyPrefix: "test/agents/",
      put: async (key, bytes) => objects.set(key, bytes),
      get: async (key) => objects.get(key),
      remove: async (key) => objects.delete(key),
    },
  });
  f.identity.scopes = ["agents:drive:read", "agents:drive:write"];
  const call = async (name, args) =>
    (await f.rpc("tools/call", { name, arguments: args })).data.result;
  const value = async (name, args) => {
    const result = await call(name, args);
    assert.ok(!result.isError, result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  const bytes = Buffer.alloc(60 * 1024, 197);
  const input = {
    operationId: "drive",
    requestId: "file",
    name: "check.bin",
    contentType: "application/octet-stream",
    base64: bytes.toString("base64"),
  };
  const staged = await value("agents_stage_file", input);
  assert.equal((await value("agents_stage_file", input)).id, staged.id);
  assert.equal(objects.size, 1);
  assert.equal(uploads, 0);
  const scope = { type: "shared", id: "workspace" };
  const p = await value("drive_upload", {
    input: { scope, parentId: null, attachmentId: staged.id },
    requestId: "upload",
  });
  assert.equal(p.status, "pending");
  assert.equal(uploads, 0);
  const decision = { proposalId: p.proposalId, review: p.preview };
  assert.equal((await value("agents_execute", decision)).status, "succeeded");
  await value("agents_execute", decision);
  assert.equal(uploads, 1);
  assert.deepEqual(Buffer.from(uploaded), bytes);
  const first = await value("drive_read_file", {
    scope,
    entryId: "00000000-0000-4000-8000-000000000001",
  });
  const second = await value("drive_read_file", {
    scope,
    entryId: "00000000-0000-4000-8000-000000000001",
    offset: first.nextOffset,
    version: first.sha256,
  });
  assert.equal(second.nextOffset, null);
  assert.deepEqual(
    Buffer.concat([first, second].map((part) => Buffer.from(part.base64, "base64"))),
    bytes,
  );
  uploaded[0] = 1;
  assert.equal(
    (
      await call("drive_read_file", {
        scope,
        entryId: "00000000-0000-4000-8000-000000000001",
        offset: first.nextOffset,
        version: first.sha256,
      })
    ).content[0].text,
    "STALE",
  );
  f.identity.connection.id = "other";
  assert.equal(
    (await call("agents_discard_file", { attachmentId: staged.id })).content[0].text,
    "NOT_FOUND",
  );
  f.identity.connection.id = "grant";
  await value("agents_discard_file", { attachmentId: staged.id });
  assert.equal(objects.size, 0);
  allowed = false;
  await assert.rejects(f.mcp.stageFile({}, { ...input, bytes }), { code: "FORBIDDEN" });
  assert.ok(
    !(await f.rpc("tools/list")).data.result.tools.some(
      (tool) => tool.name === "agents_stage_file",
    ),
  );
  allowed = true;
  f.identity.scopes = ["agents:drive:read"];
  await assert.rejects(f.mcp.stageFile({}, { ...input, bytes }), { code: "FORBIDDEN" });
  f.identity.scopes.push("agents:drive:write");
  for (const base64 of ["Zh==", Buffer.alloc(512 * 1024 + 1).toString("base64")]) {
    const result = await f.rpc("tools/call", {
      name: "agents_stage_file",
      arguments: { ...input, base64 },
    });
    assert.ok(result.data.error || result.data.result.isError);
  }
  const empty = await value("agents_stage_file", { ...input, requestId: "empty", base64: "" });
  assert.equal(empty.size, 0);
  f.revoke();
  await assert.rejects(f.mcp.stageFile({}, { ...input, bytes: new Uint8Array() }), {
    code: "FORBIDDEN",
  });
});

await test("MCP hides upload tools without private storage and validates the host byte limit", async () => {
  const { z } = await import("zod");
  const operation = {
    id: "blogs",
    label: "Blogs",
    authorize: async () => true,
    tools: [
      {
        name: "upload",
        kind: "write",
        requiresAttachments: true,
        schema: z.object({}),
      },
    ],
  };
  const f = external({ operations: [operation] });
  const names = (await f.rpc("tools/list")).data.result.tools.map((tool) => tool.name);
  assert.ok(!names.includes("upload") && !names.includes("agents_stage_file"));
  const small = fixture({ maxAttachmentBytes: 1 });
  const chat = await small.create();
  await assert.rejects(
    small.client.attach({
      conversationId: chat.id,
      name: "large.txt",
      contentType: "text/plain",
      bytes: new Uint8Array(2),
    }),
    { code: "LIMIT" },
  );
  assert.equal(small.objects.size, 0);
});
