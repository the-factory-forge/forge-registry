import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createDriveStorage } =
  await import("../../registry/components/plugins/drive/server/storage.server.ts");
const { createMenusService, menuImageDeleteGuard } =
  await import("../../registry/components/plugins/menus/server/service.server.ts");

const pool = postgres("postgres://menus_test:local_menus_test_only@127.0.0.1:55441/menus_test", {
  prepare: false,
  max: 6,
});
const db = drizzle(pool);
const s3 = new S3Client({
  endpoint: "http://127.0.0.1:19041",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "menus_test", secretAccessKey: "local_menus_test_only" },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const bucket = "forge-menus-integration";
const writable = { upload: true, createFolder: true, rename: true, delete: true, download: true };
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
  "base64",
);
const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);

test("menus, Better Auth-shaped authorization, and private Drive images", async (t) => {
  t.after(async () => {
    s3.destroy();
    await pool.end();
  });
  const drive = createDriveStorage({
    db,
    s3,
    bucket,
    canDelete: menuImageDeleteGuard,
    resolveScope: async (actor, scope) => {
      if (actor !== "staff" || scope.type !== "menu-item") return null;
      const [item] = await pool`select id from menu_item where id=${scope.id}`;
      return item ? { scope, name: "Menu item", capabilities: writable } : null;
    },
    listScopes: async () => ({ items: [] }),
  });
  const menus = createMenusService({
    db,
    drive,
    baseLocale: "en",
    authorize: async (actor) => actor === "staff",
  });
  const staff = menus.client("staff");
  if (process.env.MENUS_TEST_PHASE === "restart") {
    const publicMenu = await menus.publicMenu("fr");
    assert.equal(publicMenu.length, 1);
    assert.equal(publicMenu[0].items[0].name, "Still available");
    return;
  }

  await pool.unsafe(
    "DROP TABLE IF EXISTS menu_item, menu_label, menu_category, drive_upload, drive_entry, drive_space CASCADE",
  );
  await pool.unsafe(
    await readFile(
      new URL("../../registry/components/plugins/drive/server/migration.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.unsafe(
    await readFile(
      new URL("../../registry/components/plugins/menus/server/migration.sql", import.meta.url),
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
  await drive.verifyBucket();

  await rejected(menus.client("visitor").list(), "FORBIDDEN");
  const category = await staff.saveCategory({
    position: 0,
    translations: { en: "Starters", fr: "Entrées" },
  });
  const label = await staff.saveLabel({
    kind: "allergen",
    position: 0,
    translations: { en: "Milk", fr: "Lait" },
  });
  const input = {
    categoryId: category.id,
    priceMinor: 1450,
    position: 0,
    visible: false,
    soldOut: false,
    imageEntryId: null,
    labelIds: [label.id],
    translations: { en: { name: "Burrata", description: "Fresh cheese" } },
  };
  await rejected(staff.create({ ...input, visible: true }), "INVALID");
  const item = await staff.create(input);
  await rejected(staff.removeCategory(category.id), "IN_USE");
  await rejected(staff.removeLabel(label.id), "IN_USE");
  assert.deepEqual(await menus.publicMenu("fr"), []);

  const scope = { type: "menu-item", id: item.id };
  const driveClient = drive.client("staff");
  const ticket = await driveClient.prepareUpload({
    scope,
    parentId: null,
    requestId: crypto.randomUUID(),
    name: "burrata.png",
    size: image.length,
    contentType: "image/png",
  });
  const upload = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: image });
  assert.equal(upload.status, 200, await upload.text());
  await driveClient.completeUpload({ scope, uploadId: ticket.id });
  const [entry] = (await driveClient.listEntries({ scope, parentId: null })).items;
  assert.ok(entry);

  const published = await staff.save(item.id, 1, {
    ...input,
    visible: true,
    soldOut: true,
    imageEntryId: entry.id,
  });
  await rejected(staff.save(item.id, 1, input), "CONFLICT");
  const publicMenu = await menus.publicMenu("fr");
  assert.equal(publicMenu[0].name, "Entrées");
  assert.equal(publicMenu[0].items[0].name, "Burrata");
  assert.equal(publicMenu[0].items[0].labels[0].name, "Lait");
  assert.equal(publicMenu[0].items[0].soldOut, true);
  const response = await menus.readPublicImage(item.id);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  const preview = await driveClient.previewDelete({ scope, entryId: entry.id });
  await rejected(
    driveClient.deleteEntry({ scope, entryId: entry.id, token: preview.token }),
    "CONFLICT",
  );
  await rejected(staff.remove(item.id), "IN_USE");

  const hidden = await staff.save(item.id, published.version, {
    ...input,
    visible: false,
    imageEntryId: entry.id,
  });
  await rejected(menus.readPublicImage(item.id), "NOT_FOUND");
  await staff.save(item.id, hidden.version, input);
  await driveClient.deleteEntry({ scope, entryId: entry.id, token: preview.token });
  await staff.remove(item.id);
  await rejected(staff.get(item.id), "NOT_FOUND");

  const durable = await staff.create({
    ...input,
    translations: { en: { name: "Still available", description: "" } },
  });
  await staff.save(durable.id, durable.version, {
    ...input,
    visible: true,
    translations: { en: { name: "Still available", description: "" } },
  });
});
