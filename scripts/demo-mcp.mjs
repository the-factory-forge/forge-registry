import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { memoryStore } from "../tests/agents/fixture.mjs";
const { createAgentsMcpHandler } =
  await import("../registry/components/plugins/agents/server/mcp.server.ts");
const { createBlogsAgentOperation } =
  await import("../registry/components/connectors/agents-blogs/server/index.ts");
const { createBlogsMock } = await import("../src/showroom/blogs-mock.ts");

/** Local-only protocol fixture. Its disposable records are separate from browser demos. */
export async function startMcpDemo({
  port = 3222,
  token = randomBytes(24).toString("hex"),
  showroomOrigin = "http://127.0.0.1:3218",
} = {}) {
  const origin = new URL(showroomOrigin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    (!["127.0.0.1", "localhost"].includes(origin.hostname) &&
      !origin.hostname.endsWith(".localhost")) ||
    origin.origin !== showroomOrigin
  )
    throw new Error("The demo requires a loopback showroom origin.");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const createKey = (secret) => ({
    id: randomUUID(),
    hash: digest(secret),
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  let key = createKey(token);
  let gateway, resource, client;
  const events = [];
  const active = () => key && key.expiresAt > Date.now();
  const server = createServer(async (req, res) => {
    try {
      if (
        req.headers.host !== new URL(resource).host ||
        !["/mcp", "/demo/state", "/demo/key"].includes(req.url)
      ) {
        res.writeHead(404).end();
        return;
      }
      const management = req.url.startsWith("/demo/");
      if (management) {
        res.setHeader("Cache-Control", "no-store");
        if (req.headers.origin !== showroomOrigin) {
          res.writeHead(403).end();
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", showroomOrigin);
        res.setHeader("Vary", "Origin");
        if (req.method === "OPTIONS") {
          res
            .writeHead(204, {
              "Access-Control-Allow-Methods": "GET, POST, DELETE",
              "Access-Control-Allow-Headers": "Content-Type",
            })
            .end();
          return;
        }
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
      if (management) {
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/demo/state" && req.method === "GET") {
          const articles = await client.list({ locale: "en", pageSize: 100 });
          res.end(
            JSON.stringify({
              resource,
              expiresAt: active() ? new Date(key.expiresAt).toISOString() : null,
              articles: articles.items.map(({ id, title, version }) => ({ id, title, version })),
              events,
            }),
          );
          return;
        }
        if (req.url === "/demo/key" && req.method === "POST") {
          if (
            req.headers["content-type"] !== "application/json" ||
            Buffer.concat(chunks).toString() !== "{}"
          ) {
            res.writeHead(400).end();
            return;
          }
          const secret = randomBytes(24).toString("hex");
          key = createKey(secret);
          res.end(
            JSON.stringify({
              token: secret,
              expiresAt: new Date(key.expiresAt).toISOString(),
              resource,
            }),
          );
          return;
        }
        if (req.url === "/demo/key" && req.method === "DELETE") {
          key = null;
          res.writeHead(204).end();
          return;
        }
        res.writeHead(405).end();
        return;
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
  client = mock.client({
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
      active() &&
      request.headers.get("authorization")?.startsWith("Bearer ") &&
      digest(request.headers.get("authorization")?.slice(7) ?? "") === key.hash
        ? {
            id: "demo-admin",
            connection: { id: key.id, clientId: "registry-demo" },
            scopes: ["agents:blogs:read", "agents:blogs:write"],
          }
        : null,
    audit: (_request, event) => {
      events.push({ ...event, at: new Date().toISOString() });
      if (events.length > 12) events.shift();
    },
  });
  return {
    resource,
    token,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startMcpDemo({
    port: Number(process.env.PORT ?? 3222),
    showroomOrigin: process.env.SHOWROOM_ORIGIN ?? "http://127.0.0.1:3218",
  });
  console.log(
    `Local MCP demo: ${demo.resource}\nBearer token: ${demo.token}\nSample Blogs only. Key expires in one hour. Manage it in Agents Settings. Restart clears data and keys. No AI provider is contacted.`,
  );
}
