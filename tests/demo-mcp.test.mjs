import assert from "node:assert/strict";
import test from "node:test";

import { startMcpDemo } from "../scripts/demo-mcp.mjs";
import { mcpClient } from "./agents/mcp-client.mjs";
await test("Portless HTTPS origins are supported while remote and non-origin URLs are refused", async (t) => {
  for (const showroomOrigin of [
    "https://forge-registry.localhost",
    "http://forge-registry.localhost:1355",
    "https://localhost",
  ]) {
    const demo = await startMcpDemo({ port: 0, showroomOrigin });
    t.after(() => demo.close());
    const state = demo.resource.replace("/mcp", "/demo/state");
    const response = await fetch(state, { headers: { Origin: showroomOrigin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), showroomOrigin);
    assert.equal(
      (await fetch(state, { headers: { Origin: "https://other.localhost" } })).status,
      403,
    );
  }
  for (const showroomOrigin of [
    "https://foreign.test",
    "https://forge-registry.localhost.evil.test",
    "https://forge-registry.localhost@evil.test",
    "ftp://localhost",
    "https://forge-registry.localhost/path",
    "https://forge-registry.localhost?query=value",
  ]) {
    await assert.rejects(startMcpDemo({ port: 0, showroomOrigin }), /loopback showroom origin/);
  }
});
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
  const { rpc, call } = await mcpClient(demo.resource, demo.token);
  const list = await rpc("tools/list");
  assert.ok(list.tools.some((tool) => tool.name === "blogs_create"));
  assert.ok(!list.tools.some((tool) => tool.name === "blogs_upload"));
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
  const id = articles.items.find((item) => item.title === "MCP fixture article").id;
  const article = await call("blogs_get", { id });
  const update = await call("blogs_save", {
    input: {
      id,
      version: article.version,
      locale: "en",
      content: {
        ...article.translations.en.draft,
        title: "MCP revised article",
        markdown: "Created and changed over MCP.",
      },
      shared: article.shared,
    },
    requestId: "mcp-update",
  });
  assert.equal((await call("blogs_get", { id })).version, article.version);
  assert.equal(
    (await call("agents_execute", { proposalId: update.proposalId, review: update.preview }))
      .status,
    "succeeded",
  );
  const changed = await call("blogs_get", { id });
  assert.equal(changed.translations.en.draft.title, "MCP revised article");
  assert.equal(changed.translations.en.draft.markdown, "Created and changed over MCP.");
  const removal = await call("blogs_delete", {
    input: { id, version: changed.version },
    requestId: "mcp-delete",
  });
  assert.equal(
    (await call("agents_execute", { proposalId: removal.proposalId, review: removal.preview }))
      .status,
    "succeeded",
  );
  assert.ok(!(await call("blogs_list", { locale: "en" })).items.some((item) => item.id === id));
  const missing = await rpc("tools/call", { name: "blogs_get", arguments: { id } });
  assert.equal(missing.isError, true);
  assert.equal(missing.content[0].text, "NOT_FOUND");
});

await test("temporary demo keys rotate, expire and revoke; management requires the exact local origin", async (t) => {
  const demo = await startMcpDemo({ port: 0 });
  t.after(() => demo.close());
  const endpoint = demo.resource.replace("/mcp", "/demo/key");
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        headers: { Origin: "https://foreign.test", "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  const headers = { Origin: "http://127.0.0.1:3218", "Content-Type": "application/json" };
  assert.equal(
    (await fetch(endpoint, { method: "POST", headers, body: '{"expiresAt":"never"}' })).status,
    400,
  );
  const fresh = await fetch(endpoint, { method: "POST", headers, body: "{}" });
  assert.equal(fresh.headers.get("access-control-allow-origin"), headers.Origin);
  assert.equal(fresh.headers.get("cache-control"), "no-store");
  const key = await fresh.json();
  assert.notEqual(key.token, demo.token);
  const { call } = await mcpClient(demo.resource, key.token);
  assert.ok((await call("blogs_list", { locale: "en" })).total > 0);
  assert.equal(
    (await fetch(demo.resource, { headers: { Authorization: `Bearer ${demo.token}` } })).status,
    401,
  );
  const state = await fetch(demo.resource.replace("/mcp", "/demo/state"), { headers });
  assert.ok(!(await state.text()).includes(key.token));
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(key.expiresAt) + 1 });
  assert.equal(
    (await fetch(demo.resource, { headers: { Authorization: `Bearer ${key.token}` } })).status,
    401,
  );
  t.mock.timers.reset();
  const replacement = await (await fetch(endpoint, { method: "POST", headers, body: "{}" })).json();
  assert.equal((await fetch(endpoint, { method: "DELETE", headers })).status, 204);
  assert.equal(
    (await fetch(demo.resource, { headers: { Authorization: `Bearer ${replacement.token}` } }))
      .status,
    401,
  );
});
