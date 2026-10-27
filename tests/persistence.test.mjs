import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

// Catch raw APIs and SQL-tag aliases while leaving schema definitions out of this scan.
function rawQueries(source) {
  return /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*["']drizzle-orm["']|\.(?:sql|raw|unsafe)\s*[(\x60]|\.execute\(\s*[^)\s]|\b[\w$.]+\s*\x60(?:select|insert|update|delete|with|alter|create|drop)\b/i.test(
    source,
  );
}

await test("persistence runtime rejects handwritten SQL, including aliased imports", async () => {
  assert.deepEqual(
    rawQueries('import { sql as query } from "drizzle-orm"; db.execute(query`select 1`);'),
    true,
  );
  assert.deepEqual(rawQueries("db.select().from(users).where(eq(users.id, id));"), false);
  const root = new URL("../registry/components/", import.meta.url);
  for (const path of await readdir(root, { recursive: true })) {
    if (!path.endsWith(".ts") || !path.includes("/server/") || path.endsWith("/schema.ts"))
      continue;
    assert.deepEqual(rawQueries(await readFile(new URL(path, root), "utf8")), false, path);
  }
  assert.deepEqual(rawQueries(await readFile(new URL("utils/database.ts", root), "utf8")), false);
  assert.deepEqual(
    rawQueries(await readFile(new URL("utils/database-migrations.ts", root), "utf8")),
    false,
  );
});

await test("persistence installs schema source with pinned Drizzle, never creation SQL", async () => {
  const { items } = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  for (const name of ["drive", "blogs", "menus", "reservations", "customers", "projects"]) {
    const item = items.find((item) => item.name === `${name}-storage`);
    assert.ok(item.registryDependencies.includes("@forge/database"));
    assert.ok(item.dependencies.includes("drizzle-orm@1.0.0-rc.4"));
    assert.ok(item.files.some((file) => file.path.endsWith("/schema.ts")));
    assert.ok(item.files.every((file) => !file.path.endsWith(".sql")));
  }
});
