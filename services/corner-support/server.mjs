import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";

import { configurationSchema, createCornerSupport } from "./service.mjs";

let handler;
try {
  const config = configurationSchema.parse(
    JSON.parse(await readFile(process.env.CORNER_SUPPORT_CONFIG, "utf8")),
  );
  handler = createCornerSupport(config, await readFile(config.privateKeyFile, "utf8"));
} catch {
  console.error("Corner Support startup failed: check protected configuration and RSA key");
  process.exit(1);
}
const server = createServer(
  { requestTimeout: 15_000, headersTimeout: 10_000, maxHeaderSize: 16_384 },
  async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }
      const request = new Request(new URL(incoming.url, "http://corner-support.internal"), {
        method: incoming.method,
        headers,
        ...(["GET", "HEAD"].includes(incoming.method)
          ? {}
          : { body: Readable.toWeb(incoming), duplex: "half" }),
      });
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      if (response.status >= 400)
        console.error(JSON.stringify({ event: "support-request-failed", status: response.status }));
    } catch {
      outgoing.writeHead(503, { "Cache-Control": "private, no-store" });
      outgoing.end();
    }
  },
);
server.setTimeout(30_000, (socket) => socket.destroy());
server.listen(8080, "0.0.0.0");
process.on("SIGTERM", () => server.close());
