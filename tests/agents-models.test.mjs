import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { fixture, send } from "./agents/fixture.mjs";
const { createAgentsModelConnection } =
  await import("../registry/components/plugins/agents/server/connection.server.ts");

function setup() {
  let saved = null;
  let allowed = true;
  const store = {
    get: async () => structuredClone(saved),
    set: async (value) => {
      saved = structuredClone(value);
    },
    remove: async () => {
      saved = null;
    },
  };
  const options = {
    store,
    encryptionKey: randomBytes(32),
    authorize: async (actor) => allowed && actor === "admin",
  };
  const connection = createAgentsModelConnection(options);
  return {
    store,
    options,
    connection,
    admin: connection.client("admin"),
    deny: () => {
      allowed = false;
    },
  };
}
function stream(events, done = true) {
  const text =
    events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join("") +
    (done ? "data: [DONE]\r\n\r\n" : "");
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
  );
}
function reply(provider, tool = false) {
  if (provider === "anthropic")
    return stream(
      [
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Réponse." } },
        ...(tool
          ? [
              {
                type: "content_block_start",
                index: 1,
                content_block: { type: "tool_use", id: "tool_1", name: "save", input: {} },
              },
              {
                type: "content_block_delta",
                index: 1,
                delta: { type: "input_json_delta", partial_json: '{"value":' },
              },
              {
                type: "content_block_delta",
                index: 1,
                delta: { type: "input_json_delta", partial_json: '"changed"}' },
              },
            ]
          : []),
        { type: "message_delta", delta: { stop_reason: tool ? "tool_use" : "end_turn" } },
        { type: "message_stop" },
      ],
      false,
    );
  return stream([
    { choices: [{ delta: { content: "Réponse." } }] },
    ...(tool
      ? [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id: "call_1", function: { name: "save", arguments: '{"value":' } },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              { delta: { tool_calls: [{ index: 0, function: { arguments: '"changed"}' } }] } },
            ],
          },
        ]
      : []),
    { choices: [{ delta: {}, finish_reason: tool ? "tool_calls" : "stop" }] },
  ]);
}
const input = {
  instructions: "Trusted instructions",
  messages: [{ role: "user", text: "Hi", attachments: [] }],
  tools: [],
  signal: new AbortController().signal,
};

await test("only website administrators can read or mutate model settings", async (t) => {
  const s = setup();
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("unexpected network");
  });
  const denied = s.connection.client("staff");
  for (const promise of [
    denied.get(),
    denied.models({ provider: "openai", token: "example-key" }),
    denied.save({ provider: "openai", model: "example", token: "example-key" }),
    denied.remove(),
  ]) {
    await assert.rejects(promise, { code: "FORBIDDEN" });
  }
  for (const value of [
    null,
    {},
    { provider: "custom-url", token: "example-key" },
    { provider: "openai", token: "bad\nheader" },
  ]) {
    await assert.rejects(s.admin.models(value), { code: "INVALID" });
  }
  await assert.rejects(s.admin.models({ provider: "openai" }), { code: "INVALID" });
  assert.equal(fetch.mock.callCount(), 0);
});
for (const provider of ["openai", "anthropic", "deepseek"]) {
  await test(`${provider}: encrypted website connection drives chat and preserves approval/history`, async (t) => {
    const s = setup();
    const model = `example-${provider}`;
    let stage = 0;
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/models")) return Response.json({ data: [{ id: model }] });
      assert.equal(
        options.headers[provider === "anthropic" ? "x-api-key" : "Authorization"],
        provider === "anthropic" ? "example-private-key" : "Bearer example-private-key",
      );
      return reply(provider, stage++ === 0);
    });
    await s.admin.save({ provider, model, token: "example-private-key" });
    const document = await s.store.get();
    assert.ok(!JSON.stringify(document).includes("example-private-key"));
    assert.deepEqual(await s.admin.get(), { provider, model });
    const reloaded = createAgentsModelConnection(s.options);
    const f = fixture({ runtime: reloaded.runtime });
    const chat = await f.create();
    const proposed = await send(f.client, chat.id, "Change it");
    assert.equal(proposed.chat.actions[0].status, "pending");
    assert.equal(f.state.writes, 0);
    assert.equal(proposed.chat.messages.at(-1).text, "Réponse.");
    await f.client.decide({
      conversationId: chat.id,
      actionId: proposed.chat.actions[0].id,
      approve: true,
    });
    assert.equal(f.state.writes, 1);
    const resumed = await send(f.client, chat.id, "", { resume: true });
    assert.equal(resumed.chat.messages.at(-1).text, "Réponse.");
    const request = JSON.parse(calls.at(-1).options.body);
    assert.equal(request.model, model);
    assert.ok(
      JSON.stringify(request.messages).includes(
        provider === "anthropic" ? "tool_result" : "tool_call_id",
      ),
    );
    assert.ok(!JSON.stringify(f.store.records.get(chat.id)).includes("example-private-key"));
    const hosts = {
      openai: "api.openai.com",
      anthropic: "api.anthropic.com",
      deepseek: "api.deepseek.com",
    };
    assert.ok(
      calls.every(
        (call) =>
          new URL(call.url).hostname === hosts[provider] && call.options.redirect === "error",
      ),
    );
    await s.admin.remove();
    assert.equal(await s.admin.get(), null);
    await assert.rejects(Array.fromAsync(reloaded.runtime.stream(input)), {
      code: "NOT_CONFIGURED",
    });
    assert.ok(await f.client.get(chat.id));
  });
}
await test("replacement keys, invalid models and provider failures preserve saved configuration", async (t) => {
  const s = setup();
  let fail = false;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    if (fail) return new Response("sensitive provider error", { status: 401 });
    assert.equal(options.headers.Authorization, "Bearer example-key");
    return Response.json({ data: [{ id: "first" }, { id: "second" }] });
  });
  await s.admin.save({ provider: "openai", model: "first", token: "example-key" });
  await s.admin.save({ provider: "openai", model: "second" });
  const previous = await s.store.get();
  await assert.rejects(s.admin.save({ provider: "openai", model: "missing" }), { code: "INVALID" });
  await assert.rejects(s.admin.save({ provider: "anthropic", model: "first" }), {
    code: "INVALID",
  });
  fail = true;
  await assert.rejects(
    s.admin.save({ provider: "openai", model: "first", token: "invalid-new-key" }),
    (error) => error.message === "RUNTIME",
  );
  assert.deepEqual(await s.store.get(), previous);
  await s.store.set({ ...previous, model: "tampered" });
  await assert.rejects(Array.fromAsync(s.connection.runtime.stream(input)), { code: "RUNTIME" });
});
await test("provider pagination and lost administrator authorization are checked before saving", async (t) => {
  const s = setup();
  let page = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    page++;
    if (page === 1)
      return Response.json({
        data: [{ id: "one", display_name: "One" }],
        has_more: true,
        last_id: "one",
      });
    assert.ok(url.includes("after_id=one"));
    s.deny();
    return Response.json({ data: [{ id: "two" }], has_more: false });
  });
  await assert.rejects(
    s.admin.save({ provider: "anthropic", model: "two", token: "example-key" }),
    { code: "FORBIDDEN" },
  );
  assert.equal(await s.store.get(), null);
});
await test("truncated, failed and parallel tool streams never execute a proposed action", async (t) => {
  const s = setup();
  let mode = "truncated";
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.includes("/models")) return Response.json({ data: [{ id: "example" }] });
    if (mode === "failed") return stream([{ error: { message: "private error" } }]);
    const tools = [
      { index: 0, id: "call_1", function: { name: "save", arguments: '{"value":"changed"}' } },
    ];
    if (mode === "parallel")
      tools.push({ index: 1, id: "call_2", function: { name: "save", arguments: "{}" } });
    return stream([{ choices: [{ delta: { tool_calls: tools } }] }], false);
  });
  await s.admin.save({ provider: "openai", model: "example", token: "example-key" });
  for (mode of ["truncated", "failed", "parallel"]) {
    const f = fixture({ runtime: s.connection.runtime });
    const chat = await f.create();
    await assert.rejects(send(f.client, chat.id, "Change"), { code: "RUNTIME" });
    const saved = await f.client.get(chat.id);
    assert.equal(saved.actions.length, 0);
    assert.equal(saved.running, false);
    assert.equal(saved.canResume, true);
    assert.equal(f.state.writes, 0);
  }
});
