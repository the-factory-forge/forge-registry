import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import type { BexioSyncStatus } from "@/components/connectors/customers-bexio/contracts";

/** Instantiate with the host's customer membership key; generate migrations in the host. */
export function createBexioContactLinksSchema(customer: {
  id: AnyPgColumn<{ data: string; notNull: true }>;
}) {
  return pgTable(
    "bexio_contact_link",
    {
      id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
      installationId: text("installation_id").notNull(),
      localCustomerId: text("local_customer_id")
        .notNull()
        .references(() => customer.id, { onDelete: "cascade" }),
      bexioPersonId: integer("bexio_person_id"),
      bexioCompanyId: integer("bexio_company_id"),
      lastSyncedEmail: text("last_synced_email"),
      syncStatus: text("sync_status").$type<BexioSyncStatus>().notNull(),
      lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
      lastError: text("last_error"),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("bexio_link_customer_unique").on(table.installationId, table.localCustomerId),
      uniqueIndex("bexio_link_person_unique").on(table.installationId, table.bexioPersonId),
    ],
  );
}
export type BexioContactLinksSchema = ReturnType<typeof createBexioContactLinksSchema>;
