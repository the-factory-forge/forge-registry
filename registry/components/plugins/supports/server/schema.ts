import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  SupportAuthor,
  SupportStatus,
  SupportType,
} from "@/components/plugins/supports/types";

export const supportsTickets = pgTable(
  "supports_ticket",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type").$type<SupportType>().notNull(),
    status: text("status").$type<SupportStatus>().notNull().default("open"),
    author: jsonb("author").$type<SupportAuthor>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("supports_ticket_updated").on(table.updatedAt, table.id)],
);

export const supportsActivity = pgTable(
  "supports_activity",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportsTickets.id),
    kind: text("kind").$type<"comment" | "status">().notNull(),
    body: text("body").notNull().default(""),
    status: text("status").$type<SupportStatus>(),
    author: jsonb("author").$type<SupportAuthor>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("supports_activity_ticket").on(table.ticketId, table.createdAt, table.id)],
);

export const supportsAttachments = pgTable(
  "supports_attachment",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    requestId: text("request_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    key: text("key").notNull(),
    state: text("state")
      .$type<"uploading" | "ready" | "attached" | "cleanup" | "deleted">()
      .notNull(),
    ticketId: text("ticket_id").references(() => supportsTickets.id),
    activityId: text("activity_id").references(() => supportsActivity.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supports_attachment_request").on(table.actorId, table.requestId),
    index("supports_attachment_ticket").on(table.ticketId),
    index("supports_attachment_cleanup").on(table.state, table.updatedAt),
  ],
);

export const supportsMutations = pgTable("supports_mutation", {
  key: text("key").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportsTickets.id),
});
export type SupportTicketRecord = typeof supportsTickets.$inferSelect;
export type SupportAttachmentRecord = typeof supportsAttachments.$inferSelect;
