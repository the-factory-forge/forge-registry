import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const { createSupportsStorage } =
  await import("../../registry/components/plugins/supports/server/storage.server.ts");
import * as schema from "../../registry/components/plugins/supports/server/schema.ts";
import { pluginLocks } from "../../registry/components/utils/database.ts";
import { generatedMigration } from "../persistence/migrations.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
  "base64",
);
const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const request = () => randomUUID();
const input = (overrides = {}) => ({
  requestId: request(),
  title: "Contact form",
  description: "**Expected:** confirmation",
  type: "bug",
  attachmentIds: [],
  ...overrides,
});

await test("supports persistence, authorization, concurrent retries and private image recovery", async (t) => {
  const connection = "postgres://blogs_test:local_blogs_test_only@127.0.0.1:55440/blogs_test";
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const database = `supports_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(connection);
  url.pathname = database;
  const pool = postgres(url.href, { max: 8, onnotice: () => {} });
  const db = drizzle({ client: pool });
  const folder = await mkdtemp(join(tmpdir(), "forge-supports-migrations-"));
  const s3 = new S3Client({
    endpoint: "http://127.0.0.1:19040",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "blogs_test", secretAccessKey: "local_blogs_test_only" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const bucket = `supports-${request()}`;
  const failures = new Set();
  let objectRequests = 0;
  s3.middlewareStack.add(
    (next, context) => async (args) => {
      objectRequests++;
      if (failures.has(context.commandName)) throw new Error("Simulated object failure");
      return next(args);
    },
    { step: "initialize", name: "supportFaults" },
  );
  t.after(async () => {
    failures.clear();
    try {
      const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
      for (const object of objects.Contents ?? [])
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    } finally {
      s3.destroy();
      await pool.end();
      await root`drop database if exists ${root(database)}`;
      await root.end();
      await rm(folder, { recursive: true, force: true });
    }
  });
  await root`create database ${root(database)}`;
  const migration = join(folder, "20261109000000_supports");
  await mkdir(migration);
  await writeFile(
    join(migration, "migration.sql"),
    (await generatedMigration({}, { ...schema, pluginLocks })).join("\n--> statement-breakpoint\n"),
  );
  await migrate(db, { migrationsFolder: folder });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  const actors = new Map([
    ["alex", { id: "alex", name: "Alex Morgan", kind: "staff" }],
    ["sam", { id: "sam", name: "Sam Lee", kind: "staff" }],
    ["customer", { id: "customer", name: "Customer", kind: "customer" }],
  ]);
  const options = {
    db,
    s3,
    bucket,
    keyPrefix: "test-site/supports/",
    resolveActor: async (ctx) => actors.get(ctx) ?? null,
    authorize: async () => true,
  };
  const storage = createSupportsStorage(options);
  const alex = storage.client("alex"),
    sam = storage.client("sam");
  const upload = (overrides = {}) => ({
    requestId: request(),
    name: "Screenshot.png",
    contentType: "image/png",
    bytes: png,
    ...overrides,
  });
  let ticket;
  await t.test(
    "staff membership is required even if a host permission callback allows access",
    async () => {
      const before = objectRequests;
      for (const actor of ["anonymous", "customer"]) {
        const client = storage.client(actor);
        await rejected(client.list({}), "FORBIDDEN");
        await rejected(client.create(input()), "FORBIDDEN");
        await rejected(storage.upload(actor, upload()), "FORBIDDEN");
        await rejected(client.getAttachment("image"), "FORBIDDEN");
      }
      assert.equal(objectRequests, before);
      const denied = createSupportsStorage({ ...options, authorize: async () => false }).client(
        "alex",
      );
      await rejected(denied.create(input()), "FORBIDDEN");
    },
  );
  await t.test(
    "competing identical creates produce one record and reject conflicting request reuse",
    async () => {
      const values = input();
      const results = await Promise.all([alex.create(values), alex.create(values)]);
      assert.equal(results[0].id, results[1].id);
      ticket = results[0];
      assert.equal((await alex.list({})).total, 1);
      await rejected(alex.create({ ...values, title: "Changed" }), "CONFLICT");
      actors.set("alex", { id: "alex", name: "Renamed", kind: "staff" });
      assert.equal((await sam.get(ticket.id)).ticket.author.name, "Alex Morgan");
      await migrate(db, { migrationsFolder: folder });
      assert.equal((await sam.get(ticket.id)).ticket.id, ticket.id);
    },
  );
  await t.test(
    "concurrent comments and duplicate status transitions preserve all activity",
    async (t) => {
      const comment = { id: ticket.id, requestId: request(), body: "Reply", attachmentIds: [] };
      t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
      await Promise.all([
        alex.comment(comment),
        alex.comment(comment),
        sam.comment({ ...comment, requestId: request(), body: "Second reply" }),
        alex.setStatus(ticket.id, "closed"),
        sam.setStatus(ticket.id, "closed"),
      ]);
      let detail = await alex.get(ticket.id);
      assert.equal(detail.activity.filter((entry) => entry.kind === "comment").length, 2);
      assert.equal(detail.activity.filter((entry) => entry.kind === "status").length, 1);
      await alex.comment({ ...comment, requestId: request(), body: "Thank you" });
      assert.equal((await alex.get(ticket.id)).ticket.status, "closed");
      await Promise.all([
        alex.setStatus(ticket.id, "canceled"),
        sam.setStatus(ticket.id, "canceled"),
      ]);
      await alex.comment({ ...comment, requestId: request(), body: "No longer needed" });
      detail = await alex.get(ticket.id);
      assert.equal(detail.ticket.status, "canceled");
      assert.equal(detail.activity.filter((entry) => entry.status === "canceled").length, 1);
      await sam.setStatus(ticket.id, "open");
      detail = await alex.get(ticket.id);
      assert.equal(detail.ticket.status, "open");
      const times = detail.activity.map((entry) => Date.parse(entry.createdAt));
      assert.equal(
        new Set(times).size,
        times.length,
        "serialized activity has a stable chronology",
      );
      assert.deepEqual(
        times,
        [...times].sort((a, b) => a - b),
      );
      assert.equal(detail.ticket.updatedAt, detail.activity.at(-1).createdAt);
      await rejected(sam.setStatus(ticket.id, "resolved"), "INVALID");
    },
  );
  await t.test(
    "images stay uploader-private until atomically attached, and retries reuse bytes",
    async () => {
      const raw = upload();
      const [a, b] = await Promise.all([storage.upload("alex", raw), storage.upload("alex", raw)]);
      assert.equal(a.id, b.id);
      await rejected(sam.getAttachment(a.id), "FORBIDDEN");
      await rejected(sam.create(input({ attachmentIds: [a.id] })), "FORBIDDEN");
      const withImage = await alex.create(input({ attachmentIds: [a.id] }));
      assert.equal(withImage.attachments[0].id, a.id);
      const { url } = await sam.getAttachment(a.id);
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      await rejected(alex.cancelUpload(a.id), "CONFLICT");
      await rejected(alex.create(input({ attachmentIds: [a.id] })), "CONFLICT");
      await rejected(storage.upload("alex", { ...raw, name: "Changed.png" }), "CONFLICT");
      const replyImage = await storage.upload("sam", upload());
      await sam.comment({
        id: ticket.id,
        requestId: request(),
        body: "",
        attachmentIds: [replyImage.id],
      });
      assert.equal((await alex.get(ticket.id)).activity.at(-1).attachments[0].id, replyImage.id);
      await db
        .update(schema.supportsAttachments)
        .set({ expiresAt: new Date(0) })
        .where(eq(schema.supportsAttachments.id, a.id));
      await storage.maintenance();
      assert.equal((await fetch((await sam.getAttachment(a.id)).url)).status, 200);
    },
  );
  await t.test(
    "byte validation, missing configuration and failed PUTs do not commit usable images",
    async () => {
      await rejected(
        storage.upload("alex", upload({ bytes: Buffer.from("<svg/>"), contentType: "image/png" })),
        "INVALID",
      );
      await rejected(storage.upload("alex", upload({ contentType: "image/jpeg" })), "INVALID");
      await rejected(
        storage.upload("alex", upload({ bytes: new Uint8Array(10 * 1024 * 1024 + 1) })),
        "INVALID",
      );
      for (const keyPrefix of ["", "test-site/", "../supports/", "test-site/blogs/"]) {
        const local = createSupportsStorage({ ...options, keyPrefix });
        const before = objectRequests;
        await rejected(local.upload("alex", upload()), "STORAGE_NOT_CONFIGURED");
        assert.equal(objectRequests, before);
        await local.client("alex").create(input());
      }
      const noS3 = createSupportsStorage({ ...options, s3: undefined });
      await rejected(noS3.upload("alex", upload()), "STORAGE_NOT_CONFIGURED");
      const raw = upload();
      failures.add("PutObjectCommand");
      await rejected(storage.upload("alex", raw), "STORAGE");
      failures.clear();
      const [reserved] = await db
        .select()
        .from(schema.supportsAttachments)
        .where(eq(schema.supportsAttachments.requestId, raw.requestId));
      assert.equal(reserved.state, "uploading");
      const ready = await storage.upload("alex", raw);
      assert.equal(ready.id, reserved.id);
    },
  );
  await t.test(
    "metadata rollback after PUT retains a cleanup reservation; failed deletion is retryable",
    async () => {
      let transaction = 0;
      const faultyDb = new Proxy(db, {
        get(target, key) {
          if (key === "transaction")
            return async (fn) =>
              target.transaction(async (tx) => {
                const result = await fn(tx);
                if (++transaction === 2) throw new Error("Lost metadata commit");
                return result;
              });
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const raw = upload();
      await rejected(
        createSupportsStorage({ ...options, db: faultyDb }).upload("alex", raw),
        "STORAGE",
      );
      const [reserved] = await db
        .select()
        .from(schema.supportsAttachments)
        .where(eq(schema.supportsAttachments.requestId, raw.requestId));
      assert.equal(reserved.state, "uploading");
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: reserved.key }));
      await db
        .update(schema.supportsAttachments)
        .set({ expiresAt: new Date(0) })
        .where(eq(schema.supportsAttachments.id, reserved.id));
      failures.add("DeleteObjectCommand");
      assert.equal((await storage.maintenance()).failed, 1);
      failures.clear();
      assert.equal((await storage.maintenance()).failed, 0);
      const [deleted] = await db
        .select()
        .from(schema.supportsAttachments)
        .where(eq(schema.supportsAttachments.id, reserved.id));
      assert.equal(deleted.state, "deleted");
      await rejected(storage.upload("alex", raw), "CONFLICT");
      const fresh = await storage.upload("alex", upload());
      failures.add("DeleteObjectCommand");
      await rejected(alex.cancelUpload(fresh.id), "STORAGE");
      failures.clear();
      assert.equal((await storage.maintenance()).failed, 0);
      await rejected(alex.getAttachment(fresh.id), "FORBIDDEN");
    },
  );
  await t.test(
    "search, activity paging, process recreation and account removal preserve shared records",
    async () => {
      for (let i = 0; i < 51; i++)
        await sam.comment({
          id: ticket.id,
          requestId: request(),
          body: `More ${i}`,
          attachmentIds: [],
        });
      const first = await sam.get(ticket.id);
      assert.equal(first.activity.length, 50);
      assert(first.nextCursor);
      assert((await sam.get(ticket.id, first.nextCursor)).activity.length > 0);
      actors.delete("alex");
      const fresh = createSupportsStorage(options).client("sam");
      assert.equal((await fresh.get(ticket.id)).ticket.author.name, "Alex Morgan");
      assert((await fresh.list({ search: "confirmation" })).total > 0);
      assert.equal((await fresh.list({ search: "%" })).total, 0);
      await migrate(db, { migrationsFolder: folder });
      assert((await fresh.get(ticket.id)).activity.length > 0);
    },
  );
});
