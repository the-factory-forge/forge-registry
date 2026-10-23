import { eq } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";

export const directoryQuerySchema = z.object({
  search: z.string().trim().max(250).default(""),
  pageSize: z.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .regex(/^(0|[1-9]\d*)$/)
    .max(16)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER - 101),
    )
    .default(0),
});
export type DirectoryQuery = z.input<typeof directoryQuerySchema>;

/** Server-only query contract; accepts hosts with additional tables and relations. */
export type DatabaseTransaction = Pick<
  PostgresJsDatabase,
  "select" | "insert" | "update" | "delete"
>;
export interface PluginDatabase extends DatabaseTransaction {
  transaction<T>(action: (tx: DatabaseTransaction) => Promise<T>): Promise<T>;
}

export const pluginLocks = pgTable("forge_plugin_lock", {
  key: text("key").primaryKey(),
});

/** SQL LIKE metacharacters remain literal search text. */
export const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

export function databaseErrorCode(error: unknown): string | undefined {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
    ? cause.code
    : undefined;
}

/** Keep rows permanently: deleting a lock row lets concurrent writers lock different rows. */
export async function lockPlugin(tx: DatabaseTransaction, key: string) {
  await tx.insert(pluginLocks).values({ key }).onConflictDoNothing();
  await tx
    .select({ key: pluginLocks.key })
    .from(pluginLocks)
    .where(eq(pluginLocks.key, key))
    .for("update");
}
