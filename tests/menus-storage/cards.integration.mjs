import assert from "node:assert/strict";
import test from "node:test";

import "../drive-storage/register.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createMenusService } =
  await import("../../registry/components/plugins/menus/server/service.server.ts");
import { generatedMigration, storageSchema } from "../persistence/migrations.mjs";

const url = process.env.E2E_DATABASE_URL;

await test(
  "card adoption preserves flat menus and gates shared dishes and their image",
  { skip: !url },
  async () => {
    const target = new URL(url);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_e2e"));
    const pool = postgres(url, { max: 3 });
    const db = drizzle({ client: pool });
    const image = Buffer.from([0xff, 0xd8, 0xff]);
    const service = createMenusService({
      db,
      baseLocale: "en",
      authorize: async (actor) => actor === "staff",
      drive: { readTrustedFile: async () => ({ bytes: image, contentType: "image/jpeg" }) },
    });
    const all = await storageSchema(["menus"]);
    const { menuCards, menuCardSections, ...legacy } = all;
    const staff = service.client("staff");
    const cards = service.cardsClient("staff");
    try {
      for (const statement of await generatedMigration({}, legacy)) await pool.unsafe(statement);
      const drinks = await staff.saveCategory({ position: 0, translations: { en: "Drinks" } });
      const food = await staff.saveCategory({ position: 1, translations: { en: "Food" } });
      const item = await staff.create({
        categoryId: drinks.id,
        priceMinor: 500,
        position: 0,
        visible: false,
        soldOut: false,
        imageEntryId: null,
        labelIds: [],
        translations: { en: { name: "Apple juice", description: "" } },
      });
      await pool`update menu_item set visible=true, image_entry_id=${crypto.randomUUID()} where id=${item.id}`;
      assert.equal((await service.publicMenu("en"))[0].items[0].id, item.id);
      for (const statement of await generatedMigration(legacy, all)) await pool.unsafe(statement);
      assert.equal((await service.publicMenu("en"))[0].items[0].priceMinor, 500);
      const draft = {
        position: 0,
        translations: { en: { name: "Restaurant", description: "Seasonal food and drinks" } },
        categoryIds: [food.id, drinks.id],
        published: false,
        displayMode: "lines",
        startDate: "2026-11-11",
        endDate: "2026-11-12",
      };
      await assert.rejects(service.cardsClient("guest").saveCard(draft), { code: "FORBIDDEN" });
      await assert.rejects(cards.saveCard({ ...draft, published: true }), { code: "INVALID" });
      const restaurant = await cards.saveCard(draft);
      const brasserie = await cards.saveCard({
        ...draft,
        position: 1,
        translations: { en: { name: "Brasserie", description: "" } },
        categoryIds: [drinks.id, food.id],
      });
      assert.deepEqual(
        (await cards.listCards()).map((card) => card.categoryIds),
        [
          [food.id, drinks.id],
          [drinks.id, food.id],
        ],
      );
      assert.deepEqual(await service.publicCards("en", "2026-11-11"), []);
      assert.equal(
        (await service.previewCard("staff", restaurant.id, "fr")).categories[0].items[0].id,
        item.id,
      );
      await assert.rejects(service.previewCard("guest", restaurant.id, "en"), {
        code: "FORBIDDEN",
      });

      const first = await cards.saveCard({ ...restaurant, published: true });
      const second = await cards.saveCard({ ...brasserie, published: true });
      await assert.rejects(cards.saveCard({ ...restaurant, categoryIds: [] }), {
        code: "CONFLICT",
      });
      assert.deepEqual(await service.publicCards("en", "2026-11-10"), []);
      assert.equal((await service.publicCards("en", "2026-11-11")).length, 2);
      assert.equal(
        (await service.readPublicCardImage(item.id, "2026-11-11")).headers.get("Cache-Control"),
        "no-store",
      );

      await cards.removeCard(first.id, first.version);
      assert.equal((await service.publicCards("en", "2026-11-11")).length, 1);
      await service.readPublicCardImage(item.id, "2026-11-11");
      await cards.saveCard({ ...second, published: false });
      await assert.rejects(service.readPublicCardImage(item.id, "2026-11-11"), {
        code: "NOT_FOUND",
      });
      assert.equal((await staff.get(item.id)).categoryId, drinks.id);
      for (const priceMinor of [null, 0]) {
        const saved = await staff.create({
          categoryId: food.id,
          priceMinor,
          position: 0,
          visible: false,
          soldOut: false,
          imageEntryId: null,
          labelIds: [],
          translations: { en: { name: "Dinner inclusion", description: "" } },
        });
        assert.equal((await staff.get(saved.id)).priceMinor, priceMinor);
      }
    } finally {
      await pool.end();
    }
  },
);
