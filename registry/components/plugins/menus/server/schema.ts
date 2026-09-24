import { boolean, integer, jsonb, pgTable, text, index } from "drizzle-orm/pg-core";

import type { MenuTranslation } from "@/components/plugins/menus/types";

export const menuCategories = pgTable("menu_category", {
  id: text("id").primaryKey(),
  position: integer("position").notNull(),
  translations: jsonb("translations").$type<Record<string, string>>().notNull(),
});

export const menuLabels = pgTable("menu_label", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"allergen" | "dietary">().notNull(),
  position: integer("position").notNull(),
  translations: jsonb("translations").$type<Record<string, string>>().notNull(),
});

export const menuItems = pgTable(
  "menu_item",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "restrict" }),
    priceMinor: integer("price_minor").notNull(),
    position: integer("position").notNull(),
    visible: boolean("visible").notNull(),
    soldOut: boolean("sold_out").notNull(),
    imageEntryId: text("image_entry_id"),
    labelIds: jsonb("label_ids").$type<string[]>().notNull(),
    translations: jsonb("translations").$type<Record<string, MenuTranslation>>().notNull(),
  },
  (table) => [index("menu_item_category_position").on(table.categoryId, table.position)],
);
