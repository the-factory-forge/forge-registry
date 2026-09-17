import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/** Metadata snapshots are stored together so publication is a single atomic update. */
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
