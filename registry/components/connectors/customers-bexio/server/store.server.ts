import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  bexioSyncStatusSchema,
  type BexioContactLinkStore,
} from "@/components/connectors/customers-bexio/contracts";
import { BexioApiError } from "@/components/connectors/customers-bexio/server/client.server";
import type { BexioContactLinksSchema } from "@/components/connectors/customers-bexio/server/schema";
import { databaseErrorCode, type PluginDatabase } from "@/components/utils/database";

const id = z.string().trim().min(1).max(200);
const stateSchema = z.object({
  syncStatus: bexioSyncStatusSchema,
  lastSyncedAt: z.date().nullable(),
  lastError: z.string().max(2000).nullable(),
  lastSyncedEmail: z.email().nullable().optional(),
});
const linkSchema = stateSchema.extend({
  localCustomerId: id,
  bexioPersonId: z.number().int().positive().nullable(),
  bexioCompanyId: z.number().int().positive().nullable(),
  lastSyncedEmail: z.email().nullable(),
});

export function createBexioContactLinkStore({
  db,
  links,
  installationId,
}: {
  db: PluginDatabase;
  links: BexioContactLinksSchema;
  installationId: string;
}): BexioContactLinkStore {
  installationId = id.parse(installationId);
  const scope = eq(links.installationId, installationId);
  const customer = (value: string) => and(scope, eq(links.localCustomerId, id.parse(value)));
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BexioApiError) throw error;
      if (databaseErrorCode(error) === "23505")
        throw new BexioApiError("This Bexio person is already linked to another customer.");
      throw new BexioApiError(
        "Bexio link storage is unavailable. Retry after resolving the storage issue.",
      );
    }
  }
  return {
    async getByLocalCustomerId(value) {
      const where = customer(value);
      return run(async () => {
        const [row] = await db.select().from(links).where(where);
        return row ?? null;
      });
    },
    async list() {
      return run(async () => db.select().from(links).where(scope));
    },
    async upsert(input) {
      const value = linkSchema.parse(input);
      return run(async () => {
        const [row] = await db
          .insert(links)
          .values({ ...value, installationId })
          .onConflictDoUpdate({
            target: [links.installationId, links.localCustomerId],
            set: { ...value, updatedAt: new Date() },
          })
          .returning();
        return row;
      });
    },
    async updateSyncState(value, input) {
      const where = customer(value);
      const state = stateSchema.parse(input);
      return run(async () => {
        const [row] = await db
          .update(links)
          .set({ ...state, updatedAt: new Date() })
          .where(where)
          .returning();
        if (!row) throw new BexioApiError("Bexio link not found.");
        return row;
      });
    },
    async deleteByLocalCustomerId(value) {
      const where = customer(value);
      await run(async () => {
        await db.delete(links).where(where);
      });
    },
  };
}
