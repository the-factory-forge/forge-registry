import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Markdown and metadata snapshots are stored together so publication is a single atomic update. */
export const blogsArticles = pgTable("blogs_article", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull(),
  document: jsonb("document").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
export const blogsCategories = pgTable("blogs_category", {
  id: uuid("id").primaryKey(),
  document: jsonb("document").notNull(),
});
export const blogsHistory = pgTable(
  "blogs_history",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => blogsArticles.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    number: integer("number").notNull(),
    header: jsonb("header").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (table) => [
    uniqueIndex("blogs_history_article_locale_number").on(
      table.articleId,
      table.locale,
      table.number,
    ),
    check("blogs_history_number_check", sql`${table.number} > 0`),
  ],
);
export const blogsObjects = pgTable(
  "blogs_object",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id").notNull(),
    key: text("key").notNull().unique(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    state: text("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("blogs_object_kind_check", sql`${t.kind} = 'image'`),
    index("blogs_object_article").on(t.articleId),
    index("blogs_object_cleanup").on(t.createdAt),
  ],
);
export const blogsMutations = pgTable("blogs_mutation", {
  id: uuid("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  result: jsonb("result").notNull(),
});
