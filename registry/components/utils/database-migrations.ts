import { readMigrationFiles, type MigrationConfig } from "drizzle-orm/migrator";
import { bigint, pgSchema, pgTable, text } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Host startup preflight; inspects the existing journal without applying migrations. */
export async function assertMigrationsApplied(
  db: Pick<PostgresJsDatabase, "select">,
  config: MigrationConfig,
) {
  const columns = {
    hash: text("hash").notNull(),
    name: text("name"),
    createdAt: bigint("created_at", { mode: "number" }),
  };
  const name = config.migrationsTable ?? "__drizzle_migrations";
  const journal =
    config.migrationsSchema === "public"
      ? pgTable(name, columns)
      : pgSchema(config.migrationsSchema ?? "drizzle").table(name, columns);
  const expected = readMigrationFiles(config);
  const applied = await db.select().from(journal);
  if (
    expected.length !== applied.length ||
    expected.some(
      (migration) =>
        !applied.some(
          (row) =>
            row.name === migration.name &&
            row.hash === migration.hash &&
            row.createdAt === migration.folderMillis,
        ),
    )
  ) {
    throw new Error(
      "Project migrations are not current. Apply reviewed migrations before starting services.",
    );
  }
}
