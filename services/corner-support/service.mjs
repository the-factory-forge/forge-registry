import { createHash, createHmac, createPrivateKey, createSign, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const id = z.number().int().positive();
const secret = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
});
export const configurationSchema = z
  .strictObject({
    appId: z.string().regex(/^[1-9][0-9]*$/),
    botUserId: id,
    privateKeyFile: z.string().min(1),
    webhookSecret: secret,
    sites: z.array(
      z.strictObject({
        id: z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]*$/)
          .max(100),
        credentialHash: z.string().regex(/^[a-f0-9]{64}$/),
        installationId: id,
        repositoryId: id,
        owner: z
          .string()
          .regex(/^[A-Za-z0-9_.-]+$/)
          .max(100),
        repository: z
          .string()
          .regex(/^[A-Za-z0-9_.-]+$/)
          .max(100),
        webhookUrl: httpsUrl,
        webhookSecret: secret,
      }),
    ),
  })
  .superRefine((config, context) => {
    for (const field of ["id", "credentialHash", "repositoryId", "webhookUrl", "webhookSecret"]) {
      if (new Set(config.sites.map((site) => site[field])).size !== config.sites.length)
        context.addIssue({ code: "custom", message: `Duplicate site ${field}` });
    }
    if (config.sites.some((site) => site.webhookSecret === config.webhookSecret))
      context.addIssue({ code: "custom", message: "App and site webhook secrets must differ" });
  });

const tokenSchema = z.object({
  token: z.string().min(1).regex(/^\S+$/),
  expires_at: z.iso.datetime(),
  repositories: z.array(z.object({ id })),
  permissions: z.strictObject({ issues: z.literal("write"), metadata: z.literal("read") }),
});
const repositorySchema = z.object({
  id,
  full_name: z.string(),
  private: z.literal(true),
  visibility: z.literal("private"),
  archived: z.literal(false),
  has_issues: z.literal(true),
});
const payloadSchema = z.object({
  installation: z.object({ id }),
  repository: z.object({ id, private: z.literal(true) }),
});
const responseHeaders = { "Cache-Control": "private, no-store" };
const empty = (status) => new Response(null, { status, headers: responseHeaders });

async function boundedBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit) throw empty(413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw empty(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

/** One process owns the App key; each credential resolves to one operator-managed site. */
export function createCornerSupport(input, pem, request = fetch) {
  let config, privateKey;
  try {
    config = configurationSchema.parse(input);
    privateKey = createPrivateKey(pem);
    if (
      privateKey.asymmetricKeyType !== "rsa" ||
      privateKey.asymmetricKeyDetails.modulusLength < 2048
    )
      throw new Error();
  } catch {
    throw new Error("Invalid Corner Support configuration or RSA key");
  }
  const tokens = new Map();
  const pending = new Map();

  async function mint(site) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const claims = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: config.appId })}`;
    const jwt = `${claims}.${createSign("RSA-SHA256").update(claims).sign(privateKey, "base64url")}`;
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" };
    const response = await request(
      `https://api.github.com/app/installations/${site.installationId}/access_tokens`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { ...headers, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          repository_ids: [site.repositoryId],
          permissions: { issues: "write", metadata: "read" },
        }),
      },
    );
    if (!response.ok) throw new Error();
    const data = tokenSchema.parse(await response.json());
    const expires = Date.parse(data.expires_at);
    if (
      expires <= Date.now() + 60_000 ||
      expires > Date.now() + 3_660_000 ||
      data.repositories.length !== 1 ||
      data.repositories[0].id !== site.repositoryId
    )
      throw new Error();
    const repositoryResponse = await request(
      `https://api.github.com/repositories/${site.repositoryId}`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { ...headers, Authorization: `Bearer ${data.token}` },
      },
    );
    if (!repositoryResponse.ok) throw new Error();
    const repository = repositorySchema.parse(await repositoryResponse.json());
    if (
      repository.id !== site.repositoryId ||
      repository.full_name.toLowerCase() !== `${site.owner}/${site.repository}`.toLowerCase()
    )
      throw new Error();
    const result = {
      token: data.token,
      expires_at: data.expires_at,
      installation_id: site.installationId,
      repository_id: site.repositoryId,
      bot_user_id: config.botUserId,
    };
    tokens.set(site.id, result);
    return result;
  }

  async function token(request) {
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(authorization)) return empty(401);
    const hash = createHash("sha256").update(authorization.slice(7)).digest();
    const site = config.sites.find((candidate) =>
      timingSafeEqual(hash, Buffer.from(candidate.credentialHash, "hex")),
    );
    if (!site) return empty(401);
    // The request supplies no repository, installation, permissions or forwarding destination.
    await boundedBody(request, 0);
    let value = tokens.get(site.id);
    if (!value || Date.parse(value.expires_at) <= Date.now() + 60_000) {
      if (!pending.has(site.id))
        pending.set(
          site.id,
          mint(site).finally(() => pending.delete(site.id)),
        );
      value = await pending.get(site.id);
    }
    return Response.json(value, { headers: responseHeaders });
  }

  async function webhook(request) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return empty(403);
    const body = await boundedBody(request, 1024 * 1024);
    const expected = createHmac("sha256", config.webhookSecret).update(body).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) return empty(403);
    const event = request.headers.get("x-github-event");
    if (!["issues", "issue_comment"].includes(event)) return empty(204);
    const delivery = z.string().min(1).max(200).safeParse(request.headers.get("x-github-delivery"));
    if (!delivery.success) return empty(400);
    let payload;
    try {
      payload = payloadSchema.parse(JSON.parse(body.toString("utf8")));
    } catch {
      return empty(400);
    }
    const site = config.sites.find(
      (candidate) =>
        candidate.installationId === payload.installation.id &&
        candidate.repositoryId === payload.repository.id,
    );
    if (!site) return empty(403);
    const response = await requestForward(site, body, event, delivery.data);
    // The customer's connector persists the receipt and work before returning success.
    return empty(response ? 204 : 503);
  }

  async function requestForward(site, body, event, delivery) {
    const response = await request(site.webhookUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        "x-github-event": event,
        "x-github-delivery": delivery,
        "x-hub-signature-256": `sha256=${createHmac("sha256", site.webhookSecret).update(body).digest("hex")}`,
      },
      body,
    });
    await response.body?.cancel();
    return response.ok;
  }

  return async (request) => {
    const url = new URL(request.url);
    if (url.search) return empty(400);
    if (url.pathname === "/health" && request.method === "GET") return empty(204);
    if (!["/api/token", "/api/github/webhook"].includes(url.pathname)) return empty(404);
    if (request.method !== "POST") return empty(405);
    try {
      return await (url.pathname === "/api/token" ? token(request) : webhook(request));
    } catch (error) {
      return error instanceof Response ? error : empty(503);
    }
  };
}
