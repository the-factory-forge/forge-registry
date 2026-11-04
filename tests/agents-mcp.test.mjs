import assert from "node:assert/strict";
import test from "node:test";

import { fixture } from "./agents/fixture.mjs";
const { createAgentsService } =
  await import("../registry/components/plugins/agents/server/service.server.ts");
const { createAgentsMcpHandler } =
  await import("../registry/components/plugins/agents/server/mcp.server.ts");

function external() {
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
  };
  const service = createAgentsService(options);
  const client = service.external({});
  const mcp = createAgentsMcpHandler({ ...options, resource: "https://intranet.example/api/mcp" });
  async function rpc(method, params = {}, origin) {
    const response = await mcp.handle(
      new Request("https://intranet.example/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
          ...(origin ? { Origin: origin } : {}),
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
