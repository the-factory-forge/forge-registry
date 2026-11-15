import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";

import { createCornerSupport } from "../services/corner-support/service.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const credentials = ["a".repeat(43), "b".repeat(43)];
const config = {
  appId: "123",
  botUserId: 60,
  privateKeyFile: "/run/secrets/app.pem",
  webhookSecret: "g".repeat(43),
  sites: credentials.map((credential, index) => ({
    id: `site-${index}`,
    credentialHash: createHash("sha256").update(credential).digest("hex"),
    installationId: 50,
    repositoryId: 40 + index,
    owner: "the-factory-forge",
    repository: `site-${index}`,
    webhookUrl: `https://site-${index}.example/api/supports/github-webhook`,
    webhookSecret: String(index).repeat(43),
  })),
};
const tokenRequest = (index = 0, options = {}) =>
  new Request("https://support.example/api/token", {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials[index]}` },
    ...options,
  });
function webhookRequest(repositoryId = 40, options = {}) {
  const body = JSON.stringify({
    installation: { id: 50 },
    repository: { id: repositoryId, private: true },
    issue: { id: 2 },
  });
  return new Request("https://support.example/api/github/webhook", {
    method: "POST",
    body,
    headers: {
      "x-github-event": "issue_comment",
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": `sha256=${createHmac("sha256", config.webhookSecret).update(body).digest("hex")}`,
    },
    ...options,
  });
}
function fixture({ tokenPatch, repositoryPatch, forwardStatus = 204, fail = false } = {}) {
  const calls = [];
  const forwarded = [];
  const handler = createCornerSupport(config, pem, async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.redirect, "error");
    if (fail) throw new Error("upstream secret that must not escape");
    if (url.endsWith("/access_tokens")) {
      const [header, payload, signature] = new Headers(init.headers)
        .get("authorization")
        .slice(7)
        .split(".");
      assert.equal(
        verify(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          publicKey,
          Buffer.from(signature, "base64url"),
        ),
        true,
      );
      assert.equal(JSON.parse(Buffer.from(payload, "base64url").toString()).iss, "123");
      const body = JSON.parse(init.body);
      assert.deepEqual(body.permissions, { issues: "write", metadata: "read" });
      assert.equal(body.repository_ids.length, 1);
      return Response.json({
        token: `token-${body.repository_ids[0]}`,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        repositories: body.repository_ids.map((id) => ({ id })),
        permissions: body.permissions,
        ...tokenPatch,
      });
    }
    if (url.includes("/repositories/")) {
      const id = Number(url.split("/").at(-1));
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer token-${id}`);
      return Response.json({
        id,
        full_name: `the-factory-forge/site-${id - 40}`,
        private: true,
        visibility: "private",
        archived: false,
        has_issues: true,
        ...repositoryPatch,
      });
    }
    forwarded.push({ url, init });
    return new Response(null, { status: forwardStatus });
  });
  return { handler, calls, forwarded };
}

await test("tokens stay repository-scoped within one installation, coalesce and refresh", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-15T10:00:00Z") });
  const { handler, calls } = fixture();
  const responses = await Promise.all([
    handler(tokenRequest()),
    handler(tokenRequest()),
    handler(tokenRequest(1)),
  ]);
  const values = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(
    values.map((value) => value.repository_id),
    [40, 40, 41],
  );
  assert.deepEqual(
    values.map((value) => value.token),
    ["token-40", "token-40", "token-41"],
  );
  assert.equal(values[0].installation_id, 50);
  assert.equal(values[0].bot_user_id, 60);
  assert.equal(calls.length, 4);
  assert.equal(responses[0].headers.get("cache-control"), "private, no-store");
  await handler(tokenRequest());
  assert.equal(calls.length, 4);
  t.mock.timers.tick(3_550_000);
  await handler(tokenRequest());
  assert.equal(calls.length, 6);
});

await test("unauthorized credentials and caller-selected repositories cannot mint tokens", async () => {
  const { handler, calls } = fixture();
  assert.equal(
    (await handler(tokenRequest(0, { headers: { Authorization: `Bearer ${"c".repeat(43)}` } })))
      .status,
    401,
  );
  assert.equal((await handler(tokenRequest(0, { body: '{"repository_id":41}' }))).status, 413);
  const url = new Request("https://support.example/api/token?repository_id=41", tokenRequest());
  assert.equal((await handler(url)).status, 400);
  assert.equal(calls.length, 0);
});

await test("bad scope, expired tokens, non-private or moved repositories and upstream errors fail closed", async () => {
  for (const options of [
    { tokenPatch: { repositories: [{ id: 40 }, { id: 41 }] } },
    { tokenPatch: { permissions: { issues: "write", metadata: "read", contents: "read" } } },
    { tokenPatch: { expires_at: new Date(Date.now() - 1000).toISOString() } },
    { repositoryPatch: { private: false } },
    { repositoryPatch: { full_name: "another/repository" } },
    { repositoryPatch: { archived: true } },
    { fail: true },
  ]) {
    const { handler } = fixture(options);
    const response = await handler(tokenRequest());
    assert.equal(response.status, 503);
    assert.equal(await response.text(), "");
  }
});

await test("webhooks route by installation and repository, preserving bytes and delivery IDs with per-site signatures", async () => {
  const { handler, forwarded } = fixture();
  for (let index = 0; index < 2; index++) {
    const incoming = webhookRequest(40 + index);
    const body = Buffer.from(await incoming.clone().arrayBuffer());
    assert.equal((await handler(incoming)).status, 204);
    const { url, init } = forwarded[index];
    assert.equal(url, config.sites[index].webhookUrl);
    assert.deepEqual(init.body, body);
    assert.equal(init.headers["x-github-delivery"], "delivery-1");
    assert.equal(init.headers["x-github-event"], "issue_comment");
    assert.equal(
      init.headers["x-hub-signature-256"],
      `sha256=${createHmac("sha256", config.sites[index].webhookSecret).update(body).digest("hex")}`,
    );
  }
  // Retries retain the same receipt identity; the customer's durable receipt owns deduplication.
  await handler(webhookRequest());
  assert.equal(forwarded[2].init.headers["x-github-delivery"], "delivery-1");
});

await test("forged, foreign, oversized and unavailable webhook deliveries never get successful acknowledgement", async () => {
  const { handler, forwarded } = fixture();
  assert.equal(
    (
      await handler(
        webhookRequest(40, { headers: { "x-hub-signature-256": `sha256=${"0".repeat(64)}` } }),
      )
    ).status,
    403,
  );
  assert.equal((await handler(webhookRequest(999))).status, 403);
  const request = webhookRequest();
  const oversized = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024 + 1));
        controller.close();
      },
    }),
    duplex: "half",
  });
  assert.equal((await handler(oversized)).status, 413);
  assert.equal(forwarded.length, 0);
  assert.equal((await fixture({ forwardStatus: 503 }).handler(webhookRequest())).status, 503);
  assert.equal((await fixture({ forwardStatus: 302 }).handler(webhookRequest())).status, 503);
  assert.equal((await fixture({ fail: true }).handler(webhookRequest())).status, 503);
});

await test("ambiguous mappings and insecure destinations are rejected without disclosing configuration", () => {
  for (const change of [
    { credentialHash: config.sites[0].credentialHash },
    { repositoryId: 40 },
    { webhookSecret: config.webhookSecret },
    { webhookSecret: config.sites[0].webhookSecret },
    { webhookUrl: "http://site.example/webhook" },
    { webhookUrl: "https://site.example/webhook?secret=private" },
  ]) {
    const invalid = { ...config, sites: [config.sites[0], { ...config.sites[1], ...change }] };
    assert.throws(
      () => createCornerSupport(invalid, pem),
      /^Error: Invalid Corner Support configuration or RSA key$/,
    );
  }
});
