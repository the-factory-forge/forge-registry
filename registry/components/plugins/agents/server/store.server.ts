import { and, desc, eq } from "drizzle-orm";

import {
  agentsAttachments as attachments,
  agentsConversations as conversations,
} from "@/components/plugins/agents/server/schema";
import type { AgentsStore } from "@/components/plugins/agents/server/types";
import { AgentsError } from "@/components/plugins/agents/types";
import type { PluginDatabase } from "@/components/utils/database";

export function createAgentsStore(db: PluginDatabase): AgentsStore {
  const owner = (id: string, ownerId: string) =>
    and(eq(conversations.id, id), eq(conversations.ownerId, ownerId));
  return {
    async create(document) {
      await db.insert(conversations).values({
        id: document.id,
        ownerId: document.ownerId,
        operationId: document.operationId,
        title: document.title,
        updatedAt: document.updatedAt,
        document,
      });
    },
    async get(id, ownerId) {
      const [row] = await db.select().from(conversations).where(owner(id, ownerId));
      return row?.document ?? null;
    },
    async list(ownerId, operationId) {
      // shortcut: history shows the latest 100 chats; add cursor paging for larger host histories.
      return db
        .select({
          id: conversations.id,
          operationId: conversations.operationId,
          title: conversations.title,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .where(and(eq(conversations.ownerId, ownerId), eq(conversations.operationId, operationId)))
        .orderBy(desc(conversations.updatedAt), desc(conversations.id))
        .limit(100);
    },
    async owned(ownerId) {
      return (
        await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.ownerId, ownerId))
          .limit(100)
      ).map((row) => row.id);
    },
    change(id, ownerId, update) {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(conversations).where(owner(id, ownerId)).for("update");
        if (!row) throw new AgentsError("NOT_FOUND");
        const result = update(row.document);
        await tx
          .update(conversations)
          .set({
            document: row.document,
            title: row.document.title,
            updatedAt: row.document.updatedAt,
          })
          .where(owner(id, ownerId));
        return result;
      });
    },
    async remove(id, ownerId) {
      await db.delete(conversations).where(owner(id, ownerId));
    },
    async putAttachment(document) {
      await db
        .insert(attachments)
        .values({
          id: document.id,
          ownerId: document.ownerId,
          conversationId: document.conversationId,
          document,
        })
        .onConflictDoUpdate({ target: attachments.id, set: { document } });
    },
    async getAttachment(id, ownerId) {
      const [row] = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.ownerId, ownerId)));
      return row?.document ?? null;
    },
    async attachments(conversationId, ownerId) {
      return (
        await db
          .select()
          .from(attachments)
          .where(
            and(eq(attachments.conversationId, conversationId), eq(attachments.ownerId, ownerId)),
          )
      ).map((row) => row.document);
    },
    async removeAttachment(id, ownerId) {
      await db
        .delete(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.ownerId, ownerId)));
    },
  };
}
