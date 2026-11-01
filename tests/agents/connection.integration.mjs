import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { generatedMigration } from "../persistence/migrations.mjs";

const schema = await import("../../registry/components/plugins/agents/server/schema.ts");
const { createAgentsConnectionStore, createAgentsStore } =
  await import("../../registry/components/plugins/agents/server/store.server.ts");
const { createAgentsModelConnection } =
  await import("../../registry/components/plugins/agents/server/connection.server.ts");
const { fixture } = await import("./fixture.mjs");

await test("additive model settings migration preserves chats and persists only encrypted keys", async (t) => {
  const namespace = `agents_connection_${randomUUID().replaceAll("-", "")}`;
  const url =
    process.env.AGENTS_TEST_DATABASE_URL ??
    "postgres://agents_test:local_agents_test_only@127.0.0.1:55463/agents_test";
  const root = postgres(url, { max: 1, onnotice: () => {} });
  const pool = postgres(url, {
    max: 1,
    connection: { search_path: namespace },
    onnotice: () => {},
  });
  t.after(async () => {
    await pool.end();
    await root`drop schema if exists ${root(namespace)} cascade`;
    await root.end();
  });
  await root`create schema ${root(namespace)}`;
  const before = {
    agentsConversations: schema.agentsConversations,
    agentsAttachments: schema.agentsAttachments,
  };
  for (const sql of await generatedMigration({}, before))
    await pool.unsafe(sql.replaceAll('"public".', ""));
  const db = drizzle({ client: pool });
  const chat = fixture({ store: createAgentsStore(db) });
  const savedChat = await chat.create();
  for (const sql of await generatedMigration(before, schema))
    await pool.unsafe(sql.replaceAll('"public".', ""));
  assert.deepEqual(await generatedMigration(schema, schema), []);
  assert.equal((await chat.client.get(savedChat.id)).id, savedChat.id);
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ data: [{ id: "example-model" }] }),
  );
  const encryptionKey = randomBytes(32);
  const settings = createAgentsModelConnection({
    store: createAgentsConnectionStore(db),
    encryptionKey,
    authorize: async () => true,
  }).client("admin");
  await settings.save({
    provider: "openai",
    model: "example-model",
    token: "example-private-token",
  });
  const rows = await pool`select document from agents_model_connection`;
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes("example-private-token"));
  const fresh = createAgentsModelConnection({
    store: createAgentsConnectionStore(db),
    encryptionKey,
    authorize: async () => true,
  }).client("admin");
  assert.deepEqual(await fresh.get(), { provider: "openai", model: "example-model" });
  await fresh.save({ provider: "openai", model: "example-model" });
  await fresh.remove();
  assert.equal(await settings.get(), null);
  assert.equal((await chat.client.get(savedChat.id)).id, savedChat.id);
});
