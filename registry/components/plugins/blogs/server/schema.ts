import { sql } from "drizzle-orm";
import {
  check,
  primaryKey,
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  BlogArticle,
  BlogCategory,
  BlogHistoryHeader,
  BlogHistoryVersion,
  BlogPublication,
} from "@/components/plugins/blogs/types";

/** Markdown and metadata snapshots are stored together so publication is a single atomic update. */
export const blogsArticles = pgTable("blogs_article", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull(),
  document: jsonb("document").$type<BlogArticle>().notNull(),
  authorIds: text("author_ids").array().notNull().default([]),
  categoryIds: uuid("category_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
export const blogsCategories = pgTable("blogs_category", {
  id: uuid("id").primaryKey(),
  document: jsonb("document").$type<BlogCategory>().notNull(),
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
    header: jsonb("header").$type<BlogHistoryHeader>().notNull(),
    authorId: text("author_id").generatedAlwaysAs(sql`header->'author'->>'id'`),
    assetIds: uuid("asset_ids").array().notNull().default([]),
    payload: jsonb("payload").$type<Pick<BlogHistoryVersion, "content" | "shared">>().notNull(),
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

/** Query projections are replaced in the same transaction as their article document. */
export const blogsTranslations = pgTable(
  "blogs_translation",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => blogsArticles.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    kind: text("kind").$type<"draft" | "publication">().notNull(),
    slug: text("slug").notNull(),
    searchText: text("search_text").notNull(),
    publication: jsonb("publication").$type<BlogPublication>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    categoryIds: uuid("category_ids").array().notNull().default([]),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.locale, t.kind] }),
    index("blogs_translation_slug").on(t.locale, t.slug),
    index("blogs_translation_publication").on(t.locale, t.kind, t.publishedAt),
    check("blogs_translation_kind", sql`${t.kind} in ('draft', 'publication')`),
  ],
);
export const blogsPublicationCategories = pgTable(
  "blogs_publication_category",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => blogsArticles.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    categoryId: uuid("category_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.locale, t.categoryId] })],
);

export type BlogArticleRecord = typeof blogsArticles.$inferSelect;
export type BlogHistoryRecord = typeof blogsHistory.$inferSelect;
export type BlogTranslationRecord = typeof blogsTranslations.$inferSelect;
export type BlogCategoryRecord = typeof blogsCategories.$inferSelect;
export type BlogObjectRecord = typeof blogsObjects.$inferSelect;
export type BlogMutationRecord = typeof blogsMutations.$inferSelect;
export type BlogPublicationCategoryRecord = typeof blogsPublicationCategories.$inferSelect;
