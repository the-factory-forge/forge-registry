import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import type { AgentRecord, AgentStoredAttachment } from "@/components/plugins/agents/server/types";

/** Compose with the host schema; user deletion must call the service's removeOwner first. */
export const agentsConversations = pgTable(
  "agents_conversation",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    operationId: text("operation_id").notNull(),
    title: text("title").notNull(),
    updatedAt: text("updated_at").notNull(),
    document: jsonb("document").$type<AgentRecord>().notNull(),
  },
  (t) => [index("agents_conversation_owner_operation").on(t.ownerId, t.operationId, t.updatedAt)],
);

// Cleanup rows outlive deleted chats so a failed object deletion remains recoverable.
export const agentsAttachments = pgTable(
  "agents_attachment",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    document: jsonb("document").$type<AgentStoredAttachment>().notNull(),
  },
  (t) => [index("agents_attachment_conversation").on(t.ownerId, t.conversationId)],
);
