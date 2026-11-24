import assert from "node:assert/strict";
import test from "node:test";

import { startMcpDemo } from "../scripts/demo-mcp.mjs";
await test("local HTTP MCP fixture authenticates, discovers and executes the shared Blogs operation", async (t) => {
  const demo = await startMcpDemo({ port: 0 });
  t.after(() => demo.close());
  assert.equal((await fetch(demo.resource)).status, 401);
  const headers = {
    Authorization: `Bearer ${demo.token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-11-25",
  };
  assert.equal(
    (await fetch(demo.resource, { headers: { ...headers, Origin: "https://foreign.test" } }))
      .status,
    403,
  );
  async function rpc(method, params = {}) {
    const response = await fetch(demo.resource, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    const data = JSON.parse(
      text.startsWith("event:")
        ? text
            .split("\n")
            .find((l) => l.startsWith("data: "))
            .slice(6)
        : text,
    );
    assert.equal(data.error, undefined, JSON.stringify(data));
    return data.result;
  }
  const initialized = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "fixture-test", version: "1" },
  });
  assert.ok(initialized.protocolVersion);
  const list = await rpc("tools/list");
  assert.ok(list.tools.some((t) => t.name === "blogs_create"));
  assert.ok(!list.tools.some((t) => t.name === "blogs_upload"));
  async function call(name, args = {}) {
    const result = await rpc("tools/call", { name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  }
  const p = await call("blogs_create", {
    input: { title: "MCP fixture article", locale: "en" },
    requestId: "mcp-create",
  });
  assert.equal(p.status, "pending");
  const decision = { proposalId: p.proposalId, review: p.preview };
  assert.equal((await call("agents_execute", decision)).status, "succeeded");
  await call("agents_execute", decision);
  const articles = await call("blogs_list", { locale: "en" });
  assert.equal(articles.items.filter((item) => item.title === "MCP fixture article").length, 1);
});
