import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  primaryKey,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import type { CatalogProduct, Product, ProductCategory } from "@/components/plugins/products/model";

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

export const productCategories = pgTable("forge_product_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id").references((): AnyPgColumn => productCategories.id),
  name: text("name").notNull(),
  translations: jsonb("translations")
    .$type<ProductCategory["translations"]>()
    .notNull()
    .default({}),
  version: integer("version").notNull().default(1),
});

export const productCategoryAssignments = pgTable(
  "forge_product_category_assignment",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index("forge_product_category_products_idx").on(t.categoryId, t.productId),
  ],
);
