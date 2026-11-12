import assert from "node:assert/strict";
import test from "node:test";

import "../drive-storage/register.mjs";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createMenusService } =
  await import("../../registry/components/plugins/menus/server/service.server.ts");
import { generatedMigration, storageSchema } from "../persistence/migrations.mjs";

const url = process.env.E2E_DATABASE_URL;

await test(
  "menu adoption preserves flat data and protects shared categories, dishes, and weekly drafts",
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
    const { menuCards: _menuCards, menuCardSections: _menuCardSections, ...legacy } = all;
    const original = {
      ...legacy,
      menuCategories: pgTable("menu_category", {
        id: text("id").primaryKey(),
        position: integer("position").notNull(),
        translations: jsonb("translations").notNull(),
      }),
    };
    const staff = service.client("staff");
    const cards = service.cardsClient("staff");
    try {
      for (const statement of await generatedMigration({}, original)) await pool.unsafe(statement);
      // Existing consumers required a category before adopting this nullable schema.
      await pool`alter table menu_item alter column category_id set not null`;
      const drinksId = crypto.randomUUID();
      await pool`insert into menu_category (id,position,translations)
        values (${drinksId},0,'{"en":"Drinks"}'::jsonb)`;
      for (const statement of await generatedMigration(original, legacy))
        await pool.unsafe(statement);
      const [drinks] = await staff.categories();
      assert.deepEqual(drinks, {
        id: drinksId,
        position: 0,
        version: 1,
        translations: { en: "Drinks" },
        descriptions: {},
      });
      const food = await staff.saveCategory({ position: 1, translations: { en: "Food" } });
      const changed = await staff.saveCategory({ ...food, version: undefined });
      assert.equal(changed.version, food.version + 1);
      const unused = await staff.saveCategory({ position: 2, translations: { en: "Unused" } });
      await staff.removeCategory(unused.id);
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
      const savedItem = await staff.get(item.id);
      await assert.rejects(pool`update menu_item set category_id=null where id=${item.id}`, {
        code: "23502",
      });
      const previous = await generateDrizzleJson(legacy);
      const oldCategoryColumn = previous.ddl.find(
        (entry) =>
          entry.entityType === "columns" &&
          entry.table === "menu_item" &&
          entry.name === "category_id",
      );
      assert.ok(oldCategoryColumn);
      oldCategoryColumn.notNull = true;
      const migration = await generateMigration(
        previous,
        await generateDrizzleJson(all, previous.id),
      );
      assert.ok(
        migration.some((statement) => /ALTER COLUMN "category_id" DROP NOT NULL/.test(statement)),
      );
      for (const statement of migration) await pool.unsafe(statement);
      assert.deepEqual(await staff.get(item.id), savedItem);
      await pool`update menu_item set category_id=null where id=${item.id}`;
      assert.deepEqual(await staff.listUnassigned(), [{ ...savedItem, categoryId: null }]);
      await assert.rejects(service.readPublicImage(item.id), { code: "NOT_FOUND" });
      await pool`update menu_item set category_id=${drinks.id} where id=${item.id}`;
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
      await assert.rejects(staff.saveCategory({ ...drinks, version: undefined }), {
        code: "CONFLICT",
      });
      const shared = await staff.saveCategory({
        ...drinks,
        descriptions: { en: "Soft drinks" },
      });
      await assert.rejects(staff.saveCategory(drinks), { code: "CONFLICT" });
      await assert.rejects(staff.removeCategory(shared.id, restaurant), { code: "IN_USE" });
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
      assert.equal(
        (await service.previewCard("staff", brasserie.id, "fr")).categories[0].description,
        "Soft drinks",
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
      const currentBrasserie = (await cards.listCards()).find((card) => card.id === brasserie.id);
      const empty = await staff.saveCategory({
        position: 3,
        translations: { en: "Seasonal" },
        menu: currentBrasserie,
      });
      const withEmpty = (await cards.listCards()).find((card) => card.id === brasserie.id);
      assert.deepEqual(withEmpty.categoryIds, [drinks.id, food.id, empty.id]);
      await assert.rejects(staff.removeCategory(empty.id, currentBrasserie), { code: "CONFLICT" });
      await staff.removeCategory(empty.id, withEmpty);
      assert.equal(
        (await staff.categories()).some(({ id }) => id === empty.id),
        false,
      );

      const from = (await cards.listItems(brasserie.id)).find(({ id }) => id === item.id);
      const foodItems = (await cards.listItems(brasserie.id)).filter(
        ({ categoryId }) => categoryId === food.id,
      );
      const groups = [
        { categoryId: drinks.id, items: [] },
        {
          categoryId: food.id,
          items: [...foodItems, from].map(({ id, version }) => ({ id, version })),
        },
      ];
      const updated = await cards.placeItems(groups);
      assert.equal(updated.at(-1).categoryId, food.id);
      assert.equal(updated.at(-1).imageEntryId, from.imageEntryId);
      await assert.rejects(cards.placeItems(groups), { code: "CONFLICT" });
      assert.equal((await staff.get(item.id)).position, foodItems.length);

      const weekly = await cards.saveCard({
        ...draft,
        position: 2,
        kind: "weekly",
        categoryIds: [],
        weekdays: [5, 1],
        currencyLabel: "CHF",
        startDate: "2026-11-09",
        endDate: "2026-11-13",
      });
      assert.equal(weekly.weeklySections.length, 6);
      await assert.rejects(cards.saveCard({ ...draft, categoryIds: weekly.categoryIds }), {
        code: "INVALID",
      });
      const weeklyDish = await staff.create(
        {
          categoryId: weekly.categoryIds[0],
          priceMinor: null,
          position: 0,
          visible: true,
          soldOut: false,
          imageEntryId: null,
          labelIds: [],
          translations: { en: { name: "Monday special", description: "" } },
        },
        { visibleOnCreate: true },
      );
      assert.equal(weeklyDish.visible, true);
      await assert.rejects(
        staff.removeCategory(weekly.categoryIds[0], weekly, { items: [weeklyDish] }),
        { code: "IN_USE" },
      );
      const request = crypto.randomUUID();
      const copy = await cards.nextWeek(weekly.id, weekly.version, request);
      assert.equal((await cards.nextWeek(weekly.id, weekly.version, request)).id, copy.id);
      assert.equal(copy.published, false);
      assert.equal(copy.startDate, "2026-11-16");
      assert.equal(copy.endDate, "2026-11-20");
      assert.equal(copy.currencyLabel, "CHF");
      assert.equal(copy.categoryIds.length, 6);
      assert.ok(copy.categoryIds.every((id) => !weekly.categoryIds.includes(id)));
      assert.deepEqual(await cards.listItems(copy.id), []);
      assert.equal((await cards.listItems(weekly.id))[0].id, weeklyDish.id);
      await pool`update menu_item set image_entry_id=${crypto.randomUUID()} where id=${weeklyDish.id}`;
      const live = await cards.saveCard({ ...weekly, published: true });
      await service.readPublicCardImage(weeklyDish.id, "2026-11-11");
      const friday = await cards.saveCard({ ...live, weekdays: [5] });
      assert.equal(friday.categoryIds.length, 6);
      await assert.rejects(service.readPublicCardImage(weeklyDish.id, "2026-11-11"), {
        code: "NOT_FOUND",
      });
      assert.equal((await cards.listItems(weekly.id))[0].id, weeklyDish.id);
    } finally {
      await pool.end();
    }
  },
);
