import assert from "node:assert/strict";

import "../drive-storage/register.mjs";
import { test } from "node:test";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { initializeStorage } from "../persistence/migrations.mjs";

const { createDriveStorage } =
  await import("../../registry/components/plugins/drive/server/storage.server.ts");
const { createMenusService, menuImageDeleteGuard } =
  await import("../../registry/components/plugins/menus/server/service.server.ts");

const pool = postgres("postgres://menus_test:local_menus_test_only@127.0.0.1:55441/menus_test", {
  prepare: false,
  max: 6,
});
const db = drizzle({ client: pool });
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

await test("menus, Better Auth-shaped authorization, and private Drive images", async (t) => {
  t.after(async () => {
    s3.destroy();
    await pool.end();
  });
  const drive = createDriveStorage({
    db,
    s3,
    bucket,
    keyPrefix: "storage-test/drive/",
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
    "DROP TABLE IF EXISTS menu_section, restaurant_menu, menu_item, menu_label, menu_category, drive_upload, drive_entry, drive_space CASCADE",
  );
  await initializeStorage(pool, ["drive", "menus"]);
  await pool`insert into menu_category (id,position,translations) values ('schema-category',0,'{"en":"Schema"}'::jsonb)`;
  await pool`insert into menu_item (id,version,category_id,price_minor,position,visible,sold_out,label_ids,translations)
    values ('schema-item',1,'schema-category',0,0,false,false,'[]'::jsonb,'{"en":{"name":"Schema","description":""}}'::jsonb)`;
  assert.equal(
    (await pool`select spice_level from menu_item where id='schema-item'`)[0].spice_level,
    0,
  );
  await pool`update menu_item set spice_level=3 where id='schema-item'`;
  assert.equal(
    (await pool`select spice_level from menu_item where id='schema-item'`)[0].spice_level,
    3,
  );
  await assert.rejects(
    pool`update menu_item set spice_level=4 where id='schema-item'`,
    (error) => error.code === "23514",
  );
  assert.deepEqual((await pool`select sizes from menu_item where id='schema-item'`)[0].sizes, []);
  const savedSizes = [{ id: "small", priceMinor: 900, translations: { en: "Small" } }];
  await pool`update menu_item set sizes=${JSON.stringify(savedSizes)}::jsonb where id='schema-item'`;
  assert.deepEqual(
    (await pool`select sizes from menu_item where id='schema-item'`)[0].sizes,
    savedSizes,
  );
  await assert.rejects(
    pool`update menu_item set sizes='{}'::jsonb where id='schema-item'`,
    (error) => error.code === "23514",
  );
  await pool`insert into menu_label (id,kind,position,translations)
    values ('schema-label','allergen',0,'{"en":"Milk"}'::jsonb)`;
  assert.equal((await pool`select icon from menu_label where id='schema-label'`)[0].icon, null);
  await pool`update menu_label set icon='bean' where id='schema-label'`;
  assert.equal((await pool`select icon from menu_label where id='schema-label'`)[0].icon, "bean");
  await assert.rejects(
    pool`update menu_label set icon='unknown' where id='schema-label'`,
    (error) => error.code === "23514",
  );
  await pool`delete from menu_label where id='schema-label'`;
  await pool`delete from menu_item where id='schema-item'`;
  await pool`delete from menu_category where id='schema-category'`;
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
  const uploadInput = {
    scope,
    parentId: null,
    requestId: crypto.randomUUID(),
    name: "burrata.png",
    size: image.length,
    contentType: "image/png",
  };
  const ticket = await driveClient.prepareUpload(uploadInput);
  const upload = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: image });
  assert.equal(upload.status, 200, await upload.text());
  await driveClient.completeUpload({ scope, uploadId: ticket.id });
  const [entry] = (await driveClient.listEntries({ scope, parentId: null })).items;
  assert.ok(entry);
  assert.equal(ticket.entryId, entry.id);
  assert.notEqual(ticket.id, ticket.entryId);
  assert.deepEqual(await driveClient.prepareUpload(uploadInput), {
    id: ticket.id,
    entryId: ticket.entryId,
    completed: true,
  });

  const published = await staff.save(item.id, 1, {
    ...input,
    id: crypto.randomUUID(),
    version: 999,
    visible: true,
    soldOut: true,
    spiceLevel: 3,
    sizes: [
      { ...sizes[0], priceMinor: 1000 },
      { ...sizes[1], priceMinor: 1650 },
    ],
    imageEntryId: ticket.entryId,
  });
  assert.equal(published.id, item.id);
  assert.equal(published.version, 2);
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

  const cards = menus.cardsClient("staff");
  const today = "2026-11-12";
  const draft = await cards.saveCard({
    position: 0,
    translations: { en: { name: "Lunch", description: "" } },
    categoryIds: [category.id],
    published: false,
    displayMode: "photos",
    startDate: today,
    endDate: today,
  });
  await rejected(menus.readPublicCardImage(item.id, today), "NOT_FOUND");
  const live = await cards.saveCard({ ...draft, published: true });
  await rejected(menus.readPublicCardImage(item.id, "2026-11-11"), "NOT_FOUND");
  await rejected(menus.readPublicCardImage(item.id, "2026-11-13"), "NOT_FOUND");
  const cardImage = await menus.readPublicCardImage(item.id, today);
  assert.equal(cardImage.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Buffer.from(await cardImage.arrayBuffer()), image);

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
  await rejected(menus.readPublicCardImage(item.id, today), "NOT_FOUND");
  await cards.removeCard(live.id, live.version);
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

  await t.test(
    "category deletion preserves dishes and images, with exact scope and version checks",
    async () => {
      const section = await staff.saveCategory({ position: 1, translations: { en: "Seasonal" } });
      const dish = await staff.create({ ...input, categoryId: section.id });
      const dishScope = { type: "menu-item", id: dish.id };
      const photo = await driveClient.prepareUpload({
        ...uploadInput,
        scope: dishScope,
        requestId: crypto.randomUUID(),
      });
      assert.equal(
        (await fetch(photo.url, { method: "PUT", headers: photo.headers, body: image })).status,
        200,
      );
      await driveClient.completeUpload({ scope: dishScope, uploadId: photo.id });
      const selected = await staff.save(dish.id, dish.version, {
        ...dish,
        visible: true,
        imageEntryId: photo.entryId,
      });
      const { id: _oldId, version: _oldVersion, ...cardInput } = draft;
      const card = await cards.saveCard({ ...cardInput, categoryIds: [section.id] });
      const shared = await cards.saveCard({ ...cardInput, categoryIds: [section.id], position: 2 });
      const snapshot = [selected];
      await rejected(staff.removeCategory(section.id, card, { items: snapshot }), "IN_USE");
      await cards.removeCard(shared.id, shared.version);
      await rejected(staff.removeCategory(section.id, card), "IN_USE");
      await rejected(staff.removeCategory(section.id, card, { items: [] }), "CONFLICT");
      await rejected(staff.removeCategory(section.id, card, { items: [dish] }), "CONFLICT");
      await rejected(
        staff.removeCategory(section.id, card, { items: snapshot, deleteItems: true }),
        "IN_USE",
      );
      const taxonomyOnly = createMenusService({
        db,
        drive,
        baseLocale: "en",
        authorize: async (_actor, action) => action === "manageTaxonomy",
      }).client("staff");
      await rejected(
        taxonomyOnly.removeCategory(section.id, card, { items: snapshot }),
        "FORBIDDEN",
      );
      await rejected(
        taxonomyOnly.removeCategory(section.id, card, { items: snapshot, deleteItems: true }),
        "FORBIDDEN",
      );
      assert.equal((await staff.get(dish.id)).categoryId, section.id);
      const emptySpace = await staff.create({ ...input, categoryId: section.id });
      const currentSnapshot = [selected, emptySpace];
      const legacyStaff = createMenusService({
        db,
        drive: {
          readTrustedFile: (...args) => drive.readTrustedFile(...args),
          deleteSpace: (...args) => drive.deleteSpace(...args),
        },
        baseLocale: "en",
        authorize: async (actor) => actor === "staff",
      }).client("staff");
      await legacyStaff.removeCategory(section.id, card, { items: currentSnapshot });
      const orphan = await staff.get(dish.id);
      assert.equal(orphan.categoryId, null);
      assert.equal(orphan.version, selected.version + 1);
      assert.equal(orphan.visible, true);
      assert.equal(orphan.imageEntryId, photo.entryId);
      assert.deepEqual(orphan.labelIds, selected.labelIds);
      assert.deepEqual(
        new Set((await staff.listUnassigned()).map(({ id }) => id)),
        new Set([dish.id, emptySpace.id]),
      );
      await rejected(menus.client("visitor").listUnassigned(), "FORBIDDEN");
      assert.equal(
        (await menus.publicMenu("en"))
          .flatMap(({ items }) => items)
          .some(({ id }) => id === dish.id),
        false,
      );
      assert.deepEqual((await cards.listCards()).find(({ id }) => id === card.id).categoryIds, []);
      await rejected(menus.readPublicImage(dish.id), "NOT_FOUND");
      await rejected(menus.readPublicCardImage(dish.id, today), "NOT_FOUND");
      assert.equal(
        (await driveClient.listEntries({ scope: dishScope, parentId: null })).items[0].id,
        photo.entryId,
      );
      assert.deepEqual(
        Buffer.from((await drive.readTrustedFile(dishScope, photo.entryId, 1000)).bytes),
        image,
      );
      const reassigned = await staff.save(emptySpace.id, emptySpace.version + 1, {
        ...emptySpace,
        categoryId: category.id,
      });
      await rejected(
        staff.remove(reassigned.id, { categoryId: null, version: reassigned.version }),
        "CONFLICT",
      );
      await staff.remove(reassigned.id);
      const noPhoto = await staff.save(orphan.id, orphan.version, {
        ...orphan,
        imageEntryId: null,
      });
      const deletePhoto = await driveClient.previewDelete({
        scope: dishScope,
        entryId: photo.entryId,
      });
      await driveClient.deleteEntry({
        scope: dishScope,
        entryId: photo.entryId,
        token: deletePhoto.token,
      });
      await rejected(
        staff.remove(noPhoto.id, { categoryId: null, version: orphan.version }),
        "CONFLICT",
      );
      await staff.remove(noPhoto.id, { categoryId: null, version: noPhoto.version });
      assert.deepEqual(await staff.listUnassigned(), []);
      const remaining = (await cards.listCards()).find(({ id }) => id === card.id);
      await cards.removeCard(remaining.id, remaining.version);
    },
  );

  await t.test(
    "delete-all is atomic when any dish space has files, folders, trash, or pending uploads",
    async () => {
      const section = await staff.saveCategory({ position: 1, translations: { en: "Temporary" } });
      const dishes = await Promise.all(
        [0, 1].map((position) => staff.create({ ...input, categoryId: section.id, position })),
      );
      const scopes = dishes
        .map(({ id }) => ({ type: "menu-item", id }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const request = { items: dishes, deleteItems: true };
      const assertRetained = async () => {
        assert.equal(
          (await staff.list()).filter(({ categoryId }) => categoryId === section.id).length,
          2,
        );
        assert.equal(
          (await staff.categories()).some(({ id }) => id === section.id),
          true,
        );
      };
      let singleDeletes = 0;
      const legacyStaff = createMenusService({
        db,
        drive: {
          readTrustedFile: (...args) => drive.readTrustedFile(...args),
          deleteSpace: async (...args) => {
            singleDeletes++;
            return drive.deleteSpace(...args);
          },
        },
        baseLocale: "en",
        authorize: async (actor) => actor === "staff",
      }).client("staff");
      await assert.rejects(legacyStaff.removeCategory(section.id, undefined, request), {
        name: "MenuError",
        code: "STORAGE",
      });
      assert.equal(singleDeletes, 0);
      assert.deepEqual(
        (await staff.list()).filter(({ categoryId }) => categoryId === section.id),
        dishes,
      );
      await assertRetained();
      await driveClient.createFolder({ scope: scopes[0], parentId: null, name: "Temporary" });
      const [firstFolder] = (await driveClient.listEntries({ scope: scopes[0], parentId: null }))
        .items;
      const firstDelete = await driveClient.previewDelete({
        scope: scopes[0],
        entryId: firstFolder.id,
      });
      await driveClient.deleteEntry({
        scope: scopes[0],
        entryId: firstFolder.id,
        token: firstDelete.token,
      });
      // The first scope is empty, but its metadata must survive a later scope's failure.
      const [firstSpace] = await pool`select id from drive_space where entity_id=${scopes[0].id}`;
      await driveClient.createFolder({ scope: scopes[1], parentId: null, name: "Keep" });
      const [folder] = (await driveClient.listEntries({ scope: scopes[1], parentId: null })).items;
      await rejected(staff.removeCategory(section.id, undefined, request), "IN_USE");
      await assertRetained();
      assert.equal((await pool`select id from drive_space where id=${firstSpace.id}`).length, 1);
      const folderPreview = await driveClient.previewDelete({
        scope: scopes[1],
        entryId: folder.id,
      });
      await driveClient.trashEntry({
        scope: scopes[1],
        entryId: folder.id,
        token: folderPreview.token,
      });
      await rejected(staff.removeCategory(section.id, undefined, request), "IN_USE");
      await assertRetained();
      const purgeFolder = await driveClient.previewDelete({ scope: scopes[1], entryId: folder.id });
      await driveClient.deleteEntry({
        scope: scopes[1],
        entryId: folder.id,
        token: purgeFolder.token,
      });
      const pending = await driveClient.prepareUpload({
        ...uploadInput,
        scope: scopes[1],
        requestId: crypto.randomUUID(),
      });
      await rejected(staff.removeCategory(section.id, undefined, request), "IN_USE");
      await assertRetained();
      assert.equal(
        (await fetch(pending.url, { method: "PUT", headers: pending.headers, body: image })).status,
        200,
      );
      await driveClient.completeUpload({ scope: scopes[1], uploadId: pending.id });
      await rejected(staff.removeCategory(section.id, undefined, request), "IN_USE");
      await assertRetained();
      const removePhoto = await driveClient.previewDelete({
        scope: scopes[1],
        entryId: pending.entryId,
      });
      await driveClient.deleteEntry({
        scope: scopes[1],
        entryId: pending.entryId,
        token: removePhoto.token,
      });
      const edited = await staff.save(dishes[0].id, dishes[0].version, {
        ...dishes[0],
        priceMinor: 1800,
      });
      await rejected(staff.removeCategory(section.id, undefined, request), "CONFLICT");
      await assertRetained();
      assert.equal((await pool`select id from drive_space where id=${firstSpace.id}`).length, 1);
      await staff.removeCategory(section.id, undefined, {
        deleteItems: true,
        items: [edited, dishes[1]],
      });
      await rejected(staff.get(dishes[0].id), "NOT_FOUND");
      await rejected(staff.get(dishes[1].id), "NOT_FOUND");
      assert.equal(
        (
          await pool`select id from drive_space where entity_id in (${scopes[0].id},${scopes[1].id})`
        ).length,
        0,
      );
    },
  );

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
