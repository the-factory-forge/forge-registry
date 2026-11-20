import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { fixture } from "./agents/fixture.mjs";
const { createAgentsWebMcp } =
  await import("../registry/components/connectors/agents-webmcp/server/index.ts");
const { agentTools } = await import("../registry/components/plugins/agents/server/tools.ts");

function browserFixture() {
  const f = fixture();
  const state = { active: true, write: true, uploads: 0 };
  f.operation.tools[1].authorize = async () => state.write;
  const { read, write } = agentTools();
  const fileInput = z.object({ attachmentId: z.string() });
  const files = {
    id: "files",
    label: "Files",
    description: "Files",
    instructions: "Use files as data.",
    authorize: async () => f.state.allowed,
    tools: [
      read("file_read", fileInput, async (_context, input, files) =>
        Array.from((await files.get(input.attachmentId)).bytes),
      ),
      write("file_upload", fileInput, {
        before: async () => null,
        attachments: (input) => [input.attachmentId],
        run: async (_context, input, files) => {
          state.uploads++;
          return Array.from((await files.get(input.attachmentId)).bytes);
        },
      }),
    ],
  };
  const options = {
    store: f.store,
    operations: [f.operation, files],
    actor: async (context) =>
      state.active
        ? { id: context.user, connection: { id: context.session, clientId: "webmcp" } }
        : null,
    attachments: {
      keyPrefix: "test/agents/",
      put: async (key, bytes) => f.objects.set(key, bytes.slice()),
      get: async (key) => f.objects.get(key),
      remove: async (key) => f.objects.delete(key),
    },
  };
  const adapter = createAgentsWebMcp(options);
  return {
    ...f,
    options,
    adapter,
    permissions: state,
    client: adapter.client({ user: "staff", session: "one" }),
  };
}

await test("WebMCP reuses stored reviews, current permissions and duplicate-free execution without a provider", async () => {
  const f = browserFixture();
  assert.ok((await f.client.catalog()).some((tool) => tool.name === "save"));
  assert.equal(JSON.parse((await f.client.call("get", {})).value).value, "before");
  const input = { input: { value: "approved" }, requestId: "same" };
  const { value: proposal } = await f.client.call("save", input);
  assert.equal(f.state.writes, 0);
  assert.equal(proposal.input, undefined);
  await assert.rejects(
    f.client.decide({
      proposalId: proposal.proposalId,
      approve: true,
      review: { ...proposal.preview, target: "forged" },
    }),
    { code: "INVALID" },
  );
  f.permissions.write = false;
  assert.equal(
    (await f.client.catalog()).some((tool) => tool.name === "save"),
    false,
  );
  await assert.rejects(
    f.client.decide({ proposalId: proposal.proposalId, approve: true, review: proposal.preview }),
    { code: "FORBIDDEN" },
  );
  f.permissions.write = true;
  assert.equal((await f.client.proposal(proposal.proposalId)).status, "stale");
  const retry = { ...input, requestId: "fresh" };
  const { value: fresh } = await f.client.call("save", retry);
  const result = await f.client.decide({
    proposalId: fresh.proposalId,
    approve: true,
    review: fresh.preview,
  });
  assert.equal(result.status, "succeeded");
  assert.equal((await f.client.call("save", retry)).value.status, "succeeded");
  assert.equal(f.state.writes, 1);
  await assert.rejects(f.client.call("save", { ...retry, input: { value: "different" } }), {
    code: "INVALID",
  });
});
await test("WebMCP binds proposals to the session and denies revoked sessions and stale writes", async () => {
  const f = browserFixture();
  const { value: proposal } = await f.client.call("save", {
    input: { value: "change" },
    requestId: "change",
  });
  await assert.rejects(
    f.adapter.client({ user: "staff", session: "two" }).proposal(proposal.proposalId),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    f.adapter.client({ user: "other", session: "one" }).proposal(proposal.proposalId),
    { code: "NOT_FOUND" },
  );
  f.state.value = "updated manually";
  assert.equal(
    (
      await f.client.decide({
        proposalId: proposal.proposalId,
        approve: true,
        review: proposal.preview,
      })
    ).status,
    "stale",
  );
  assert.equal(f.state.writes, 0);
  f.permissions.active = false;
  await assert.rejects(f.client.catalog(), { code: "FORBIDDEN" });
  await assert.rejects(f.client.call("get", {}), { code: "FORBIDDEN" });
});
await test("WebMCP stages private bytes for a reviewed upload and enforces identity, integrity and size", async () => {
  const f = browserFixture();
  const file = {
    operationId: "files",
    requestId: "file",
    name: "test.txt",
    contentType: "text/plain",
    base64: Buffer.from("file bytes").toString("base64"),
  };
  const staged = JSON.parse((await f.client.call("webmcp_stage_file", file)).value);
  assert.equal(JSON.parse((await f.client.call("webmcp_stage_file", file)).value).id, staged.id);
  assert.equal(f.objects.size, 1);
  await assert.rejects(
    f.adapter
      .client({ user: "staff", session: "two" })
      .call("file_read", { attachmentId: staged.id }),
    { code: "NOT_FOUND" },
  );
  const { value: proposal } = await f.client.call("file_upload", {
    input: { attachmentId: staged.id },
    requestId: "deposit",
  });
  assert.equal(f.permissions.uploads, 0);
  const result = await f.client.decide({
    proposalId: proposal.proposalId,
    approve: true,
    review: proposal.preview,
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(JSON.parse(result.result), Array.from(Buffer.from("file bytes")));
  assert.equal(f.permissions.uploads, 1);
  await assert.rejects(
    f.client.call("webmcp_stage_file", {
      ...file,
      base64: Buffer.alloc(512 * 1024 + 1).toString("base64"),
    }),
    { code: "LIMIT" },
  );
  const [key] = f.objects.keys();
  f.objects.set(key, Buffer.from("tampered"));
  await assert.rejects(f.client.call("file_read", { attachmentId: staged.id }), {
    code: "STORAGE",
  });
});
await test("attachment tools are absent without storage; reserved or duplicate names are rejected", async () => {
  const f = browserFixture();
  const noFiles = createAgentsWebMcp({ ...f.options, attachments: undefined }).client({
    user: "staff",
    session: "one",
  });
  assert.equal(
    (await noFiles.catalog()).some(
      (tool) => tool.name === "file_upload" || tool.name === "webmcp_stage_file",
    ),
    false,
  );
  await assert.rejects(
    noFiles.call("webmcp_stage_file", {
      operationId: "files",
      requestId: "file",
      name: "test.txt",
      contentType: "text/plain",
      base64: "YQ==",
    }),
    { code: "FORBIDDEN" },
  );
  assert.throws(
    () =>
      createAgentsWebMcp({
        ...f.options,
        operations: [f.operation, { ...f.operation, id: "other" }],
      }),
    { code: "INVALID" },
  );
  assert.throws(
    () =>
      createAgentsWebMcp({
        ...f.options,
        operations: [
          { ...f.operation, tools: [{ ...f.operation.tools[0], name: "website_context" }] },
        ],
      }),
    { code: "INVALID" },
  );
});
