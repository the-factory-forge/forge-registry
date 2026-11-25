import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createProductsService } =
  await import("../../registry/components/plugins/products/server/index.ts");
import { initializeStorage } from "./migrations.mjs";

await test("Products PostgreSQL publishing lifecycle, bounded public reads, competing writes and deletion", async (t) => {
  const ns = "products_" + randomUUID().replaceAll("-", "");
  const url = "postgres://drive_test:local_drive_test_only@127.0.0.1:55439/drive_test";
  const root = postgres(url, { max: 1, onnotice: () => {} });
  const pool = postgres(url, { connection: { search_path: ns }, onnotice: () => {} });
  t.after(async () => {
    await pool.end();
    await root`drop schema if exists ${root(ns)} cascade`;
    await root.end();
  });
  await root`create schema ${root(ns)}`;
  await initializeStorage(pool, ["products"]);
  const permissions = new Set(["read", "create", "edit", "publish"]);
  const service = createProductsService({
    db: drizzle({ client: pool }),
    authorize: async (ctx, action) => ctx === "staff" && permissions.has(action),
  });
  const staff = service.client("staff"),
    other = service.client("visitor");
  const rejects = (promise, code) => assert.rejects(promise, (e) => e.code === code);
  const privateRow = await staff.create({ name: "A private product", published: true });
  const first = await staff.create({ name: "zebra", slug: "sample-tree" });
  for (const key of [first.id, first.slug, randomUUID(), "missing", "../invalid"])
    await rejects(service.publicGet(key), "NOT_FOUND");
  await rejects(staff.create({ name: "Duplicate", slug: first.slug }), "SLUG_TAKEN");
  await rejects(staff.create({ name: "Ambiguous", slug: first.id }), "INVALID");
  assert.equal(first.published, false);
  assert.deepEqual(await service.publicList(), { items: [], nextCursor: null });
  for (const attempt of [
    other.get(first.id),
    other.list(),
    other.create({ name: "X" }),
    other.save(first.id, 1, { name: "X" }),
    other.setPublished(first.id, 1, true),
    other.delete(first.id, 1),
  ])
    await rejects(attempt, "FORBIDDEN");
  permissions.delete("publish");
  await rejects(staff.setPublished(first.id, 1, true), "FORBIDDEN");
  permissions.add("publish");
  await rejects(
    staff.create({ name: "A", characteristics: [{ label: "Size", value: " " }] }),
    "INVALID",
  );
  await rejects(service.publicList({ cursor: "bad" }), "INVALID");
  const live = await staff.setPublished(first.id, first.version, true);
  assert.equal((await service.publicGet(first.id)).slug, first.slug);
  const pairs = [
    { label: "Width", value: "80 cm" },
    { label: "Material", value: "Oak" },
  ];
  const media = {
    banner: { src: "/photos/banner.jpg", alt: "Birch tabletop" },
    thumbnail: { src: "https://example.com/thumb.jpg", alt: "" },
    gallery: [
      { src: "/photos/wood.jpg", alt: "Wood grain" },
      { src: "/photos/edge.jpg", alt: "Edge" },
    ],
  };
  const edits = await Promise.allSettled(
    [0, 1].map(() =>
      staff.save(live.id, live.version, {
        name: "Birch",
        media,
        priceMinor: 0,
        description: "Plain text",
        characteristics: pairs,
        translations: {
          fr: { name: "Abricotier", characteristics: [{ label: "Bois", value: "Bouleau" }] },
        },
      }),
    ),
  );
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(edits.find((r) => r.status === "rejected").reason.code, "CONFLICT");
  const saved = await staff.get(live.id);
  assert.equal(saved.slug, first.slug);
  const second = await staff.create({ name: "apricot" });
  await rejects(staff.save(second.id, 1, { name: "apricot", slug: first.slug }), "SLUG_TAKEN");
  await staff.setPublished(second.id, 1, true);
  assert.equal((await service.publicGet(second.id)).id, second.id);
  let page = await service.publicList({ pageSize: 1 });
  assert.deepEqual(
    page.items.map((p) => p.name),
    ["apricot"],
  );
  page = await service.publicList({ pageSize: 1, cursor: page.nextCursor });
  assert.equal(page.nextCursor, null);
  assert.deepEqual(page.items, [
    {
      id: saved.id,
      media,
      slug: first.slug,
      name: "Birch",
      description: "Plain text",
      characteristics: pairs,
      priceMinor: 0,
    },
  ]);
  const firstFrenchPage = await service.publicList({ locale: "fr", pageSize: 1 });
  assert.equal(firstFrenchPage.items[0].name, "apricot");
  const french = await service.publicList({ locale: "fr", cursor: firstFrenchPage.nextCursor });
  assert.deepEqual(french.items, [
    {
      id: saved.id,
      media,
      slug: first.slug,
      name: "Abricotier",
      description: "",
      characteristics: [{ label: "Bois", value: "Bouleau" }],
      priceMinor: 0,
    },
  ]);
  assert.equal(french.nextCursor, null);
  for (const key of [saved.id, saved.slug])
    assert.deepEqual(await service.publicGet(key, "fr"), french.items[0]);
  const legacySave = await staff.save(saved.id, saved.version, {
    name: saved.name,
    description: saved.description,
    characteristics: saved.characteristics,
    priceMinor: saved.priceMinor,
  });
  assert.equal(legacySave.translations.fr.name, "Abricotier");
  assert.deepEqual(legacySave.media, media);
  const cleared = await staff.save(saved.id, legacySave.version, { ...legacySave, media: {} });
  assert.equal((await service.publicGet(saved.id)).media, undefined);
  const hidden = await staff.setPublished(saved.id, cleared.version, false);
  assert.deepEqual(
    (await service.publicList()).items.map((p) => p.name),
    ["apricot"],
  );
  for (const key of [saved.id, saved.slug]) await rejects(service.publicGet(key), "NOT_FOUND");
  assert.deepEqual((await staff.get(saved.id)).characteristics, pairs);
  await rejects(staff.setPublished(saved.id, saved.version, true), "CONFLICT");
  await staff.setPublished(saved.id, hidden.version, true);
  assert.equal((await service.publicList()).items.length, 2);
  assert.equal(
    (await staff.list({ sort: { field: "priceMinor", direction: "desc" }, pageSize: 1 })).items[0]
      .id,
    saved.id,
  );
  assert.equal((await staff.get(privateRow.id)).published, false);
  const filtered = await staff.list({ search: "bIr", pageSize: 1 });
  assert.deepEqual(
    filtered.items.map((p) => p.id),
    [saved.id],
  );
  assert.equal(filtered.nextCursor, null);
  assert.deepEqual((await staff.list({ search: "%" })).items, []);
  const current = await staff.get(saved.id);
  await rejects(staff.delete(current.id, current.version), "FORBIDDEN");
  permissions.add("delete");
  await rejects(staff.delete(current.id, saved.version), "CONFLICT");
  await rejects(staff.delete(current.id, 0), "INVALID");
  await rejects(staff.delete("invalid", current.version), "INVALID");
  await staff.delete(current.id, current.version);
  await rejects(staff.get(current.id), "NOT_FOUND");
  await rejects(service.publicGet(current.slug), "NOT_FOUND");
  assert.deepEqual(
    (await service.publicList()).items.map((p) => p.name),
    ["apricot"],
  );
  await staff.delete(privateRow.id, privateRow.version);
  assert.deepEqual(
    (await staff.list()).items.map((p) => p.name),
    ["apricot"],
  );
});
