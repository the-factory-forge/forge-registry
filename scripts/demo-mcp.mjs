import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { memoryStore } from "../tests/agents/fixture.mjs";
const { createAgentsMcpHandler } =
  await import("../registry/components/plugins/agents/server/mcp.server.ts");
const { createBlogsAgentOperation } =
  await import("../registry/components/connectors/agents-blogs/server/index.ts");
const { createBlogsMock } = await import("../src/showroom/blogs-mock.ts");

/** Local-only protocol fixture. Its disposable records are separate from browser demos. */
export async function startMcpDemo({ port = 3222, token = randomBytes(24).toString("hex") } = {}) {
  let gateway, resource;
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(resource).host || req.url !== "/mcp") {
        res.writeHead(404).end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const request = new Request(resource, {
        method: req.method,
        headers: req.headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = await gateway.handle(request, request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end("Demo request failed");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  resource = `http://127.0.0.1:${server.address().port}/mcp`;
  const mock = createBlogsMock();
  const client = mock.client({
    editor: { id: "demo-admin", name: "Demo administrator" },
    admin: true,
    readOnly: false,
    fail: false,
    consumeUploadFailure: () => {},
  });
  gateway = createAgentsMcpHandler({
    resource,
    store: memoryStore(),
    operations: [createBlogsAgentOperation({ client: () => client, authorize: async () => true })],
    actor: async (request) =>
      request.headers.get("authorization") === `Bearer ${token}`
        ? {
            id: "demo-admin",
            connection: { id: "demo-grant", clientId: "manual-inspector" },
            scopes: ["agents:blogs:read", "agents:blogs:write"],
          }
        : null,
  });
  return {
    resource,
    token,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startMcpDemo({ port: Number(process.env.PORT ?? 3222) });
  console.log(
    `Local MCP demo: ${demo.resource}\nBearer token: ${demo.token}\nSample Blogs only. Restart clears the data. No AI provider is contacted.`,
  );
}
