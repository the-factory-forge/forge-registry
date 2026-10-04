import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, index, check } from "drizzle-orm/pg-core";

import type {
  MenuItemSize,
  MenuSpiceLevel,
  MenuTranslation,
} from "@/components/plugins/menus/types";

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
    sizes: jsonb("sizes").$type<MenuItemSize[]>().notNull().default([]),
    position: integer("position").notNull(),
    visible: boolean("visible").notNull(),
    soldOut: boolean("sold_out").notNull(),
    spiceLevel: integer("spice_level").$type<MenuSpiceLevel>().notNull().default(0),
    imageEntryId: text("image_entry_id"),
    labelIds: jsonb("label_ids").$type<string[]>().notNull(),
    translations: jsonb("translations").$type<Record<string, MenuTranslation>>().notNull(),
  },
  (table) => [
    index("menu_item_category_position").on(table.categoryId, table.position),
    check("menu_item_spice_level_check", sql`${table.spiceLevel} between 0 and 3`),
    check("menu_item_sizes_check", sql`jsonb_typeof(${table.sizes}) = 'array'`),
  ],
);
