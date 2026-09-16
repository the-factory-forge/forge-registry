import "./register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";

import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  CopyObjectCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { drizzle } from "drizzle-orm/postgres-js";
import { chromium } from "playwright";
import postgres from "postgres";
import ts from "typescript";
const { createDriveStorage } =
  await import("../../registry/components/plugins/drive/server/storage.server.ts");

const pool = postgres("postgres://drive_test:local_drive_test_only@127.0.0.1:55439/drive_test", {
  prepare: false,
  max: 6,
});
const db = drizzle(pool);
const bucket = "forge-drive-integration";
const s3 = new S3Client({
  endpoint: "http://127.0.0.1:19039",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "drive_test", secretAccessKey: "local_drive_test_only" },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const writable = { upload: true, createFolder: true, rename: true, delete: true, download: true };
const a = { type: "project", id: "alpha" },
  b = { type: "customer", id: "alpha" };
let allowed = true;
const options = {
  db,
  s3,
  bucket,
  maxFileBytes: 1024,
  resolveScope: async (user, scope) =>
    allowed && user !== "stranger" && ["project", "customer", "workspace"].includes(scope.type)
      ? {
          scope,
          name: `${scope.type} ${scope.id}`,
          capabilities:
            user === "reader"
              ? { ...writable, upload: false, createFolder: false, rename: false, delete: false }
              : writable,
        }
      : null,
  listScopes: async () => ({
    items: [a, b].map((scope) => ({ scope, name: scope.id, capabilities: writable })),
  }),
};
const storage = createDriveStorage(options);
const client = storage.client("editor");
const list = (scope = a, parentId = null) => client.listEntries({ scope, parentId });
const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);
async function reserve(name, parentId = null, scope = a, body = "hello") {
  const input = {
    scope,
    parentId,
    name,
    requestId: randomUUID(),
    size: Buffer.byteLength(body),
    contentType: "text/plain",
  };
  const ticket = await client.prepareUpload(input);
  return { input, ticket, body };
}
async function put(upload) {
  const response = await fetch(upload.ticket.url, {
    method: "PUT",
    headers: upload.ticket.headers,
    body: upload.body,
  });
  assert.equal(response.status, 200, await response.text());
}
async function complete(upload) {
  await client.completeUpload({ scope: upload.input.scope, uploadId: upload.ticket.id });
}
async function upload(name, parentId = null, scope = a) {
  const value = await reserve(name, parentId, scope);
  await put(value);
  await complete(value);
  return value;
}
async function remove(scope, entry) {
  const preview = await client.previewDelete({ scope, entryId: entry.id });
  await client.deleteEntry({ scope, entryId: entry.id, token: preview.token });
}

// Fixed localhost-only credentials/ports are intentionally independent of host app configuration.
test("private Drive persistence and storage recovery", async (t) => {
  t.after(async () => {
    s3.destroy();
    await pool.end();
  });
  if (process.env.DRIVE_TEST_PHASE === "restart") {
    const page = await list({ type: "workspace", id: "restart" });
    assert.equal(page.items[0].name, "Persistent.txt");
    const { url } = await client.getDownload({
      scope: page.space.scope,
      entryId: page.items[0].id,
    });
    assert.equal(await (await fetch(url)).text(), "hello");
    return;
  }
  await pool.unsafe("DROP TABLE IF EXISTS drive_upload, drive_entry, drive_space CASCADE");
  await pool.unsafe(
    await readFile(
      new URL("../../registry/components/plugins/drive/server/migration.sql", import.meta.url),
      "utf8",
    ),
  );
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (error.name !== "BucketAlreadyOwnedByYou") throw error;
  }
  const existing = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  for (const object of existing.Contents ?? [])
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "expire-staging",
            Status: "Enabled",
            Filter: { Prefix: "drive/staging/" },
            Expiration: { Days: 1 },
          },
        ],
      },
    }),
  );
  await storage.verifyBucket();

  await t.test(
    "spaces are lazy; permission checks and parent isolation apply to every write",
    async () => {
      assert.equal((await client.listSpaces({})).items.length, 2);
      assert.equal((await list()).items.length, 0);
      assert.equal((await pool`select * from drive_space`).length, 0);
      await rejected(
        storage.client("stranger").listEntries({ scope: a, parentId: null }),
        "NOT_FOUND",
      );
      await rejected(
        storage.client("reader").createFolder({ scope: a, parentId: null, name: "forbidden" }),
        "FORBIDDEN",
      );
      await client.createFolder({ scope: a, parentId: null, name: "Assets" });
      const folder = (await list()).items[0];
      await rejected(
        client.createFolder({ scope: b, parentId: folder.id, name: "cross-space" }),
        "NOT_FOUND",
      );
      await rejected(client.rename({ scope: b, entryId: folder.id, name: "forged" }), "NOT_FOUND");
      await rejected(client.previewDelete({ scope: b, entryId: folder.id }), "NOT_FOUND");
      await rejected(client.getDownload({ scope: b, entryId: folder.id }), "NOT_FOUND");
      await rejected(
        client.createFolder({ scope: a, parentId: null, name: "../unsafe" }),
        "INVALID",
      );
      await rejected(client.createFolder({ scope: a, parentId: null, name: "Assets" }), "CONFLICT");
      await rejected(storage.assertSpaceEmpty("editor", a), "CONFLICT");
    },
  );
  await t.test(
    "verified uploads are idempotent, private and downloaded as attachments",
    async () => {
      const value = await reserve("Notes.txt");
      const duplicate = await client.prepareUpload(value.input);
      assert.equal(duplicate.id, value.ticket.id);
      assert.equal(
        (await list()).items.some((entry) => entry.name === "Notes.txt"),
        false,
      );
      await rejected(complete(value), "STORAGE");
      await put(value);
      await Promise.all([complete(value), complete(value)]);
      const rows = (await list()).items.filter((entry) => entry.name === "Notes.txt");
      assert.equal(rows.length, 1);
      assert.equal((await client.prepareUpload(value.input)).completed, true);
      const { url } = await client.getDownload({ scope: a, entryId: rows[0].id });
      assert.equal(new URL(url).searchParams.get("X-Amz-Expires"), "300");
      const response = await fetch(url);
      assert.equal(await response.text(), "hello");
      assert.match(response.headers.get("content-disposition"), /^attachment;/);
      assert.equal((await fetch(url.split("?")[0])).status, 403);
      await rejected(client.getDownload({ scope: b, entryId: rows[0].id }), "NOT_FOUND");
      await client.rename({ scope: a, entryId: rows[0].id, name: "Renamed.txt" });
      assert.equal(
        new URL((await client.getDownload({ scope: a, entryId: rows[0].id })).url).pathname,
        new URL(url).pathname,
      );
      await remove(a, rows[0]);
      await complete(value); // A deleted completed file cannot be resurrected by a delayed retry.
      assert.equal(
        (await list()).items.some((entry) => entry.id === rows[0].id),
        false,
      );
    },
  );
  await t.test("browser XHR transfers use the real signed URL and storage CORS", async () => {
    const transferSource = await readFile(
      new URL("../../registry/components/plugins/drive/transfer.ts", import.meta.url),
      "utf8",
    );
    const utilsSource = await readFile(
      new URL("../../registry/components/plugins/drive/utils.ts", import.meta.url),
      "utf8",
    );
    const compile = (source) =>
      ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", request.url === "/" ? "text/html" : "text/javascript");
      response.end(
        request.url === "/"
          ? "<!doctype html><title>Drive transfer harness</title>"
          : request.url === "/transfer.js"
            ? compile(transferSource).replace("@/components/plugins/drive/utils", "/utils.js")
            : compile(utilsSource),
      );
    });
    await new Promise((resolve) => server.listen(19040, "127.0.0.1", resolve));
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto("http://127.0.0.1:19040");
      const value = await reserve("browser.txt");
      const progress = await page.evaluate(async ({ ticket, body }) => {
        const { transferDriveUpload } = await import("/transfer.js");
        const values = [];
        await transferDriveUpload(ticket, new File([body], "browser.txt", { type: "text/plain" }), {
          signal: new AbortController().signal,
          onProgress: (value) => values.push(value),
        });
        return values;
      }, value);
      assert.ok(progress.includes(100));
      await complete(value);
      assert.equal((await list()).items.filter((entry) => entry.name === "browser.txt").length, 1);
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
  await t.test("size, expiry, scope and authorization are rechecked at completion", async () => {
    await rejected(
      client.prepareUpload({
        scope: a,
        parentId: null,
        requestId: randomUUID(),
        name: "large",
        size: 1025,
        contentType: "text/plain",
      }),
      "INVALID",
    );
    const value = await reserve("wrong-size");
    const row = (await pool`select * from drive_upload where id=${value.ticket.id}`)[0];
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `drive/staging/${row.space_id}/${row.storage_id}`,
        Body: "too long",
        ContentType: "text/plain",
      }),
    );
    await rejected(complete(value), "INVALID");
    assert.equal(
      (await list()).items.some((entry) => entry.name === "wrong-size"),
      false,
    );
    await rejected(client.completeUpload({ scope: b, uploadId: value.ticket.id }), "NOT_FOUND");
    allowed = false;
    await rejected(complete(value), "NOT_FOUND");
    allowed = true;
    await pool`update drive_upload set expires_at=now()-interval '1 minute' where id=${value.ticket.id}`;
    await rejected(complete(value), "EXPIRED");
    await storage.maintenance();
    assert.equal((await pool`select * from drive_entry where id=${row.entry_id}`).length, 0);
    const expiredUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: `drive/staging/${row.space_id}/${row.storage_id}`,
        ContentType: "text/plain",
      }),
      { expiresIn: 1, signingDate: new Date(Date.now() - 60_000) },
    );
    const expiredResponse = await fetch(expiredUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: value.body,
    });
    assert.equal(expiredResponse.status, 403);
    assert.match(await expiredResponse.text(), /expired/i);
  });
  await t.test(
    "copy/database failures preserve a retryable reservation and orphan cleanup",
    async () => {
      const value = await reserve("recovery");
      await put(value);
      const send = s3.send.bind(s3);
      s3.send = async (command, ...rest) => {
        if (command instanceof CopyObjectCommand) throw new Error("storage offline");
        return send(command, ...rest);
      };
      try {
        await rejected(complete(value), "STORAGE");
      } finally {
        s3.send = send;
      }
      assert.equal(
        (await list()).items.some((entry) => entry.name === "recovery"),
        false,
      );
      await pool.unsafe(
        "CREATE OR REPLACE FUNCTION drive_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state = 'ready' AND OLD.state = 'uploading' THEN RAISE EXCEPTION 'test database failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER drive_test_failure BEFORE UPDATE ON drive_entry FOR EACH ROW EXECUTE FUNCTION drive_test_fail()",
      );
      try {
        await rejected(complete(value), "STORAGE");
      } finally {
        await pool.unsafe(
          "DROP TRIGGER drive_test_failure ON drive_entry; DROP FUNCTION drive_test_fail()",
        );
      }
      assert.equal(
        (await list()).items.some((entry) => entry.name === "recovery"),
        false,
      );
      await complete(value);
      assert.equal((await list()).items.filter((entry) => entry.name === "recovery").length, 1);
      const abandoned = await reserve("abandoned");
      await put(abandoned);
      await client.cancelUpload({ scope: a, uploadId: abandoned.ticket.id });
      await rejected(complete(abandoned), "EXPIRED");
    },
  );
  await t.test(
    "recursive deletion survives partial S3 failure and blocks competing uploads",
    async () => {
      const folder = (await list()).items.find((entry) => entry.name === "Assets");
      await client.createFolder({ scope: a, parentId: folder.id, name: "nested" });
      await upload("child.txt", folder.id);
      const racing = await reserve("racing.txt", folder.id);
      await put(racing);
      const preview = await client.previewDelete({ scope: a, entryId: folder.id });
      assert.deepEqual(
        { files: preview.files, folders: preview.folders },
        { files: 2, folders: 2 },
      );
      const send = s3.send.bind(s3);
      s3.send = async (command, ...rest) => {
        if (command instanceof DeleteObjectCommand) throw new Error("delete offline");
        return send(command, ...rest);
      };
      try {
        await rejected(
          client.deleteEntry({ scope: a, entryId: folder.id, token: preview.token }),
          "DELETE_PENDING",
        );
      } finally {
        s3.send = send;
      }
      assert.equal((await list()).items.find((entry) => entry.id === folder.id).state, "deleting");
      await rejected(
        client.createFolder({ scope: a, parentId: folder.id, name: "late" }),
        "CONFLICT",
      );
      await rejected(complete(racing), "CONFLICT");
      for (let pass = 0; pass < 4; pass++) await storage.maintenance({ limit: 10 });
      assert.equal(
        (await list()).items.some((entry) => entry.id === folder.id),
        false,
      );
      await client.deleteEntry({ scope: a, entryId: folder.id, token: preview.token });
      await rejected(complete(racing), "EXPIRED");
    },
  );
  await t.test(
    "stale confirmation rejects new descendants; empty-space deletion is explicit",
    async () => {
      await client.createFolder({ scope: b, parentId: null, name: "folder" });
      const folder = (await list(b)).items[0];
      const preview = await client.previewDelete({ scope: b, entryId: folder.id });
      await client.createFolder({ scope: b, parentId: folder.id, name: "new child" });
      await rejected(
        client.deleteEntry({ scope: b, entryId: folder.id, token: preview.token }),
        "CONFLICT",
      );
      await rejected(storage.deleteSpace("editor", b), "CONFLICT");
      await remove(b, folder);
      await storage.assertSpaceEmpty("editor", b);
      await storage.deleteSpace("editor", b);
      assert.equal(
        (await pool`select * from drive_space where entity_type=${b.type} and entity_id=${b.id}`)
          .length,
        0,
      );
    },
  );
  await t.test(
    "entity deletion locks out a concurrent write and maintenance stays bounded",
    async () => {
      let entered, proceed;
      const waiting = new Promise((resolve) => {
        entered = resolve;
      });
      const gate = new Promise((resolve) => {
        proceed = resolve;
      });
      const scope = { type: "workspace", id: "atomic-delete" };
      const deletion = storage.deleteSpace("editor", scope, async () => {
        entered();
        await gate;
        allowed = false;
      });
      await waiting;
      const write = client.createFolder({ scope, parentId: null, name: "late" });
      // Attach the rejection assertion before releasing the competing transaction.
      const denied = rejected(write, "NOT_FOUND");
      proceed();
      await deletion;
      await denied;
      allowed = true;
      assert.equal((await list(scope)).items.length, 0);
      for (let i = 0; i < 3; i++) await reserve(`expired-${i}`);
      await pool`update drive_upload set expires_at=now()-interval '1 minute' where state='active'`;
      const result = await storage.maintenance({ limit: 1 });
      assert.ok(result.operations <= 1);
      for (let i = 0; i < 10; i++) await storage.maintenance({ limit: 5 });
      assert.equal((await pool`select * from drive_entry where state <> 'ready'`).length, 0);
    },
  );
  await upload("Persistent.txt", null, { type: "workspace", id: "restart" });
});
