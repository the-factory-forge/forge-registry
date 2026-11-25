import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import type { CatalogProduct, Product } from "@/components/plugins/products/model";

export const products = pgTable(
  "forge_product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique(),
    name: text("name").notNull(),
    sortName: text("sort_name").generatedAlwaysAs(sql`lower(name)`),
    description: text("description").notNull().default(""),
    characteristics: jsonb("characteristics")
      .$type<CatalogProduct["characteristics"]>()
      .notNull()
      .default([]),
    media: jsonb("media").$type<NonNullable<Product["media"]>>().notNull().default({}),
    translations: jsonb("translations")
      .$type<NonNullable<Product["translations"]>>()
      .notNull()
      .default({}),
    priceMinor: integer("price_minor"),
    published: boolean("published").notNull().default(false),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    check("forge_product_price_nonnegative", sql`${t.priceMinor} >= 0`),
    index("forge_product_catalog_idx").on(t.published, t.sortName, t.id),
  ],
);
