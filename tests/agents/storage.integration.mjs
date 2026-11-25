import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { generatedMigration } from "../persistence/migrations.mjs";
import { fixture, send } from "./fixture.mjs";
const schema = await import("../../registry/components/plugins/agents/server/schema.ts");
const { createAgentsStore } =
  await import("../../registry/components/plugins/agents/server/store.server.ts");

await test("generated Drizzle schema, durable approvals, concurrent processes and private object cleanup", async (t) => {
  const namespace = `agents_${randomUUID().replaceAll("-", "")}`;
  const connection =
    process.env.AGENTS_TEST_DATABASE_URL ??
    "postgres://drive_test:local_drive_test_only@127.0.0.1:55439/drive_test";
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const pool = postgres(connection, {
    max: 6,
    connection: { search_path: namespace },
    onnotice: () => {},
  });
  const db = drizzle({ client: pool });
  const bucket = `agents-${randomUUID()}`;
  const endpoint = process.env.AGENTS_TEST_S3_URL ?? "http://127.0.0.1:19039";
  const s3 = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "drive_test", secretAccessKey: "local_drive_test_only" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  t.after(async () => {
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    s3.destroy();
    await pool.end();
    await root`drop schema if exists ${root(namespace)} cascade`;
    await root.end();
  });
  await root`create schema ${root(namespace)}`;
  for (const sql of await generatedMigration({}, schema))
    await pool.unsafe(sql.replaceAll('"public".', ""));
  assert.deepEqual(await generatedMigration(schema, schema), []);
  const store = createAgentsStore(db);
  const attachments = {
    keyPrefix: "integration/agents/",
    put: (Key, Body, ContentType) =>
      s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType })),
    get: async (Key) =>
      (await s3.send(new GetObjectCommand({ Bucket: bucket, Key }))).Body.transformToByteArray(),
    remove: (Key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })),
  };
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  const f = fixture({ store, attachments });
  const chat = await f.create();
  const file = await f.client.attach({
    conversationId: chat.id,
    name: "note.txt",
    contentType: "text/plain",
    bytes: new TextEncoder().encode("private bytes"),
  });
  assert.equal((await f.client.attachment(chat.id, file.id)).bytes.length, 13);
  const row = (await store.attachments(chat.id, "staff"))[0];
  const unsigned = await fetch(`${endpoint}/${bucket}/${row.key}`);
  assert.equal(unsigned.status, 403);
  const { chat: proposal } = await send(f.client, chat.id, "after");
  // A separately constructed service models a fresh process using the same persisted state.
  const second = fixture({ store: createAgentsStore(db), attachments });
  assert.equal((await second.client.get(chat.id)).actions[0].status, "pending");
  await Promise.all(
    [f.client, second.client].map((client) =>
      client.decide({ conversationId: chat.id, actionId: proposal.actions[0].id, approve: true }),
    ),
  );
  assert.equal(f.state.writes + second.state.writes, 1);
  assert.equal((await second.client.get(chat.id)).actions[0].status, "succeeded");
  await assert.rejects(f.service.client("other").get(chat.id), { code: "NOT_FOUND" });
  assert.equal((await f.client.list("blogs"))[0].title, "after");
  const external = fixture({
    store,
    attachments,
    actor: async (id) => ({ id, connection: { id: "browser-session", clientId: "webmcp" } }),
  }).service.external("staff");
  const staged = await external.stage({
    operationId: "blogs",
    requestId: "old-file",
    name: "staged.txt",
    contentType: "text/plain",
    bytes: new TextEncoder().encode("staged bytes"),
  });
  const stagedRow = await store.getAttachment(staged.id, "staff");
  await store.change(stagedRow.conversationId, "staff", (record) => {
    record.updatedAt = "2000-01-01T00:00:00.000Z";
  });
  assert.deepEqual(await store.expiredStaging("staff", new Date().toISOString()), [
    stagedRow.conversationId,
  ]);
  assert.deepEqual(await store.expiredStaging("other", new Date().toISOString()), []);
  await external.stage({
    operationId: "blogs",
    requestId: "fresh-file",
    name: "fresh.txt",
    contentType: "text/plain",
    bytes: new TextEncoder().encode("fresh bytes"),
  });
  assert.equal(await store.getAttachment(staged.id, "staff"), null);
  await assert.rejects(
    s3.send(new GetObjectCommand({ Bucket: bucket, Key: stagedRow.key })),
    (error) => error.$metadata.httpStatusCode === 404,
  );
  await f.service.removeOwner("staff");
  assert.equal((await store.owned("staff")).length, 0);
  await assert.rejects(
    s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.key })),
    (error) => error.$metadata.httpStatusCode === 404,
  );
});
