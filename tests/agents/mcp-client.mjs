import assert from "node:assert/strict";

export async function mcpClient(resource, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-11-25",
  };
  async function rpc(method, params = {}) {
    const response = await fetch(resource, {
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
  async function call(name, args = {}) {
    const result = await rpc("tools/call", { name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  }
  await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "registry-crud-check", version: "1" },
  });
  return { rpc, call };
}
