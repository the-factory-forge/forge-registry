import assert from "node:assert/strict";
import test from "node:test";

import { fixture } from "./agents/fixture.mjs";
const { createPluginAgentClient } = await import("../src/showroom/plugin-agent-client.ts");
const { createSupportsAgentOperation } =
  await import("../registry/components/connectors/agents-supports/server/index.ts");
const { createAgentConversationsOperation } =
  await import("../registry/components/connectors/agents-conversations/server/index.ts");

await test("plugin previews share reviewed execution, concurrent retries and current permissions", async () => {
  const f = fixture();
  const client = createPluginAgentClient(() => [f.operation]);
  const input = { input: { value: "after" }, requestId: "same-change" };
  const [first, retry] = await Promise.all([
    client.call("save", input),
    client.call("save", input),
  ]);
  assert.equal(first.value.proposalId, retry.value.proposalId);
  assert.equal(f.state.writes, 0);
  const decision = {
    proposalId: first.value.proposalId,
    review: first.value.preview,
    approve: true,
  };
  assert.equal((await client.decide(decision)).status, "succeeded");
  await client.decide(decision);
  assert.equal(f.state.writes, 1);
  assert.equal(JSON.parse((await client.call("get", {})).value).value, "after");
  await assert.rejects(client.call("save", { ...input, input: { value: "different" } }), {
    code: "INVALID",
  });
  const rejected = (
    await client.call("save", { input: { value: "rejected" }, requestId: "reject" })
  ).value;
  assert.equal(
    (
      await client.decide({
        proposalId: rejected.proposalId,
        review: rejected.preview,
        approve: false,
      })
    ).status,
    "rejected",
  );
  const stale = (await client.call("save", { input: { value: "stale" }, requestId: "stale" }))
    .value;
  f.state.value = "manual change";
  assert.equal(
    (await client.decide({ proposalId: stale.proposalId, review: stale.preview, approve: true }))
      .status,
    "stale",
  );
  f.state.allowed = false;
  assert.deepEqual(await client.catalog(), []);
  await assert.rejects(client.call("get", {}), { code: "FORBIDDEN" });
  assert.equal(f.state.writes, 1);
});

await test("Supports preserves comment validation and invokes the ordinary client after approval", async () => {
  const calls = [];
  const op = createSupportsAgentOperation({
    authorize: async () => true,
    client: () => ({
      get: async () => ({ id: "ticket", title: "Sample ticket" }),
      comment: async (input) => {
        calls.push(input);
        return { id: "ticket" };
      },
    }),
  });
  const client = createPluginAgentClient(() => [op]);
  assert.ok((await client.catalog()).some((t) => t.name === "supports_comment"));
  await assert.rejects(
    client.call("supports_comment", {
      input: { id: "ticket", body: " ", attachmentIds: [] },
      requestId: "empty",
    }),
    { code: "INVALID" },
  );
  const p = (
    await client.call("supports_comment", {
      input: { id: "ticket", body: "Reviewed comment", attachmentIds: [] },
      requestId: "comment",
    })
  ).value;
  assert.equal(calls.length, 0);
  await client.decide({ proposalId: p.proposalId, review: p.preview, approve: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body, "Reviewed comment");
  assert.ok(calls[0].requestId);
});

await test("Agents connector shows the complete inner business review and catches changed proposals", async () => {
  const f = fixture();
  const chat = await f.client.create("blogs");
  const action = {
    id: "action",
    messageId: "message",
    status: "pending",
    preview: {
      title: "Delete record",
      target: "Customer 42",
      changes: [{ label: "name", before: "Before", after: "After" }],
      effects: ["Deletes related documents"],
      attachmentIds: ["private-file"],
    },
  };
  let approved = 0;
  const op = createAgentConversationsOperation({
    authorizeOperation: async () => true,
    authorize: async () => true,
    client: () => ({
      ...f.client,
      get: async () => ({ ...chat, actions: [action] }),
      decide: async () => {
        approved++;
        return chat;
      },
    }),
  });
  const client = createPluginAgentClient(() => [op]);
  const names = (await client.catalog()).map((t) => t.name);
  assert.ok(names.includes("conversations_send"));
  assert.ok(!names.some((n) => /settings|key|password/.test(n)));
  const p = (
    await client.call("conversations_decide", {
      input: { conversationId: chat.id, actionId: "action", approve: true },
      requestId: "approve",
    })
  ).value;
  assert.equal(p.preview.target, "Customer 42");
  assert.deepEqual(
    p.preview.changes.slice(0, action.preview.changes.length),
    action.preview.changes,
  );
  assert.equal(p.preview.changes.at(-1).after, "private-file");
  assert.deepEqual(p.preview.effects, ["Deletes related documents"]);
  action.preview.effects.push("Changed effect");
  assert.equal(
    (await client.decide({ proposalId: p.proposalId, review: p.preview, approve: true })).status,
    "stale",
  );
  assert.equal(approved, 0);
});
