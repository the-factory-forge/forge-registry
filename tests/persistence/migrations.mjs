import "../drive-storage/register.mjs";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";

export async function storageSchema(names) {
  const schema = {};
  for (const name of names) {
    Object.assign(
      schema,
      await import(`../../registry/components/plugins/${name}/server/schema.ts`),
    );
  }
  const { pluginLocks } = await import("../../registry/components/utils/database.ts");
  schema.pluginLocks = pluginLocks;
  return schema;
}

export async function generatedMigration(before, after) {
  const previous = await generateDrizzleJson(before);
  const current = await generateDrizzleJson(after, previous.id);
  return generateMigration(previous, current);
}

export async function initializeStorage(pool, names) {
  const statements = await generatedMigration({}, await storageSchema(names));
  for (const statement of statements) {
    // Honor the isolated test search_path; production migrations keep their schema qualifiers.
    await pool.unsafe(
      statement
        .replaceAll('"public".', "")
        .replace(
          'CREATE TABLE "forge_plugin_lock"',
          'CREATE TABLE IF NOT EXISTS "forge_plugin_lock"',
        ),
    );
  }
}
