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
    trash: {},
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
    assert.equal(publicMenu[0].items[0].spiceLevel, 2);
    assert.equal(publicMenu[0].items[0].labels[0].icon, "bean");
    assert.deepEqual(publicMenu[0].items[0].sizes, [
      { id: "glass", priceMinor: 370, name: "2 dl" },
      { id: "bottle", priceMinor: 2200, name: "1,5 l" },
    ]);
    assert.equal(publicMenu[0].items[0].priceMinor, 370);
    assert.deepEqual(
      (await staff.list()).map((item) => item.translations.en.name),
      ["Order anchor", "Still available"],
    );
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
  const upgrade = await readFile(
    new URL("../../registry/components/plugins/menus/server/spice-level.sql", import.meta.url),
    "utf8",
  );
  await pool`insert into menu_category (id,position,translations) values ('legacy-category',0,'{"en":"Legacy"}'::jsonb)`;
  await pool`insert into menu_item (id,version,category_id,price_minor,position,translations)
    values ('legacy-item',1,'legacy-category',0,0,'{"en":{"name":"Legacy","description":""}}'::jsonb)`;
  await pool.unsafe(upgrade);
  assert.equal(
    (await pool`select spice_level from menu_item where id='legacy-item'`)[0].spice_level,
    0,
  );
  await pool`update menu_item set spice_level=3 where id='legacy-item'`;
  await pool.unsafe(upgrade);
  assert.equal(
    (await pool`select spice_level from menu_item where id='legacy-item'`)[0].spice_level,
    3,
  );
  await assert.rejects(
    pool`update menu_item set spice_level=4 where id='legacy-item'`,
    (error) => error.code === "23514",
  );
  const sizesUpgrade = await readFile(
    new URL("../../registry/components/plugins/menus/server/sizes.sql", import.meta.url),
    "utf8",
  );
  await pool.unsafe(sizesUpgrade);
  assert.deepEqual((await pool`select sizes from menu_item where id='legacy-item'`)[0].sizes, []);
  const legacySizes = [{ id: "small", priceMinor: 900, translations: { en: "Small" } }];
  await pool`update menu_item set sizes=${JSON.stringify(legacySizes)}::jsonb where id='legacy-item'`;
  await pool.unsafe(sizesUpgrade);
  assert.deepEqual(
    (await pool`select sizes from menu_item where id='legacy-item'`)[0].sizes,
    legacySizes,
  );
  await assert.rejects(
    pool`update menu_item set sizes='{}'::jsonb where id='legacy-item'`,
    (error) => error.code === "23514",
  );
  await pool`insert into menu_label (id,kind,position,translations)
    values ('legacy-label','allergen',0,'{"en":"Milk"}'::jsonb)`;
  const iconUpgrade = await readFile(
    new URL("../../registry/components/plugins/menus/server/label-icon.sql", import.meta.url),
    "utf8",
  );
  await pool.unsafe(iconUpgrade);
  assert.equal((await pool`select icon from menu_label where id='legacy-label'`)[0].icon, null);
  await pool`update menu_label set icon='bean' where id='legacy-label'`;
  await pool.unsafe(iconUpgrade);
  assert.equal((await pool`select icon from menu_label where id='legacy-label'`)[0].icon, "bean");
  await assert.rejects(
    pool`update menu_label set icon='unknown' where id='legacy-label'`,
    (error) => error.code === "23514",
  );
  await pool`delete from menu_label where id='legacy-label'`;
  await pool`delete from menu_item where id='legacy-item'`;
  await pool`delete from menu_category where id='legacy-category'`;
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
  assert.equal(label.icon, null);
  await rejected(menus.client("visitor").saveLabel({ ...label, icon: "bean" }), "FORBIDDEN");
  await rejected(staff.saveLabel({ ...label, icon: "unknown" }), "INVALID");
  assert.equal((await staff.saveLabel({ ...label, icon: "bean" })).icon, "bean");
  const { icon: _icon, ...legacyLabel } = label;
  assert.equal((await staff.saveLabel(legacyLabel)).icon, "bean");
  assert.equal((await staff.saveLabel({ ...label, icon: null })).icon, null);
  await staff.saveLabel({ ...label, icon: "bean" });
  assert.equal((await staff.labels()).find((entry) => entry.id === label.id).icon, "bean");
  const input = {
    categoryId: category.id,
    priceMinor: 1450,
    position: 0,
    visible: false,
    soldOut: false,
    spiceLevel: 1,
    imageEntryId: null,
    labelIds: [label.id],
    translations: { en: { name: "Burrata", description: "Fresh cheese" } },
  };
  await rejected(staff.create({ ...input, visible: true }), "INVALID");
  await rejected(staff.create({ ...input, spiceLevel: 4 }), "INVALID");
  const sizes = [
    { id: "small", priceMinor: 900, translations: { en: "Small", fr: "Petite" } },
    { id: "large", priceMinor: 1450, translations: { en: "Large" } },
  ];
  await rejected(staff.create({ ...input, sizes: [{ ...sizes[0], priceMinor: -1 }] }), "INVALID");
  const item = await staff.create({ ...input, sizes });
  assert.deepEqual((await staff.get(item.id)).sizes, sizes);
  assert.equal(item.priceMinor, 900);
  assert.equal(item.spiceLevel, 1);
  assert.equal((await staff.get(item.id)).spiceLevel, 1);
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
    spiceLevel: 3,
    sizes: [
      { ...sizes[0], priceMinor: 1000 },
      { ...sizes[1], priceMinor: 1650 },
    ],
    imageEntryId: entry.id,
  });
  await rejected(staff.save(item.id, 1, input), "CONFLICT");
  const publicMenu = await menus.publicMenu("fr");
  assert.equal(publicMenu[0].name, "Entrées");
  assert.equal(publicMenu[0].items[0].name, "Burrata");
  assert.equal(publicMenu[0].items[0].labels[0].name, "Lait");
  assert.equal(publicMenu[0].items[0].soldOut, true);
  assert.equal(publicMenu[0].items[0].spiceLevel, 3);
  assert.deepEqual(publicMenu[0].items[0].sizes, [
    { id: "small", priceMinor: 1000, name: "Petite" },
    { id: "large", priceMinor: 1650, name: "Large" },
  ]);
  const legacyInput = { ...input };
  delete legacyInput.spiceLevel;
  const retained = await staff.save(item.id, published.version, {
    ...legacyInput,
    visible: true,
    soldOut: true,
    imageEntryId: entry.id,
  });
  assert.equal(retained.spiceLevel, 3);
  assert.deepEqual(retained.sizes, published.sizes);
  assert.equal(retained.priceMinor, 1000);
  const response = await menus.readPublicImage(item.id);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  const preview = await driveClient.previewDelete({ scope, entryId: entry.id });
  await rejected(
    driveClient.trashEntry({ scope, entryId: entry.id, token: preview.token }),
    "CONFLICT",
  );
  await rejected(
    driveClient.deleteEntry({ scope, entryId: entry.id, token: preview.token }),
    "CONFLICT",
  );
  await rejected(staff.remove(item.id), "IN_USE");

  const hidden = await staff.save(item.id, retained.version, {
    ...input,
    visible: false,
    sizes: [],
    imageEntryId: entry.id,
  });
  assert.deepEqual(hidden.sizes, []);
  assert.equal(hidden.priceMinor, 1450);
  await rejected(menus.readPublicImage(item.id), "NOT_FOUND");
  await staff.save(item.id, hidden.version, input);
  await driveClient.trashEntry({ scope, entryId: entry.id, token: preview.token });
  const current = await staff.get(item.id);
  await rejected(
    staff.save(item.id, current.version, { ...input, imageEntryId: entry.id }),
    "NOT_FOUND",
  );
  await rejected(drive.readTrustedFile(scope, entry.id, 1000000), "NOT_FOUND");
  const purge = await driveClient.previewDelete({ scope, entryId: entry.id });
  await driveClient.deleteEntry({ scope, entryId: entry.id, token: purge.token });
  await staff.remove(item.id);
  await rejected(staff.get(item.id), "NOT_FOUND");

  const first = await staff.create({ ...input, sizes });
  const second = await staff.create({ ...input, position: 1 });
  const order = [second, first].map(({ id, version }) => ({ id, version }));
  await rejected(menus.client("visitor").reorder(order), "FORBIDDEN");
  const ordered = await staff.reorder(order);
  assert.deepEqual(
    (await staff.list()).map(({ id, position }) => [id, position]),
    [
      [second.id, 0],
      [first.id, 1],
    ],
  );
  assert.deepEqual((await staff.get(first.id)).sizes, sizes);
  await rejected(staff.reorder(order), "CONFLICT");
  await rejected(staff.reorder([ordered[0], ordered[0]]), "INVALID");
  await rejected(staff.reorder(ordered.slice(1)), "CONFLICT");
  assert.deepEqual(await staff.list(), ordered);
  const competing = await Promise.allSettled([
    staff.reorder([...ordered].reverse()),
    staff.reorder([...ordered].reverse()),
  ]);
  assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(competing.find((result) => result.status === "rejected").reason.code, "CONFLICT");
  assert.deepEqual(
    (await staff.list()).map(({ id }) => id),
    [first.id, second.id],
  );
  await staff.remove(first.id);
  await staff.remove(second.id);

  const durable = await staff.create({
    ...input,
    translations: { en: { name: "Still available", description: "" } },
  });
  await staff.save(durable.id, durable.version, {
    ...input,
    visible: true,
    translations: { en: { name: "Still available", description: "" } },
    spiceLevel: 2,
    sizes: [
      { id: "glass", priceMinor: 370, translations: { en: "2 dl" } },
      { id: "bottle", priceMinor: 2200, translations: { en: "1.5 l", fr: "1,5 l" } },
    ],
  });
  const anchor = await staff.create({
    ...input,
    translations: { en: { name: "Order anchor", description: "" } },
  });
  await staff.reorder([anchor, await staff.get(durable.id)]);
});
