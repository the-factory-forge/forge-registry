import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  compareDriveItems,
  validSort,
  validName,
  validId,
  validScope,
  safeDownloadUrl,
} from "../registry/components/plugins/drive/utils.ts";

test("Drive rejects ambiguous names, unsafe download URLs and invalid identifiers", () => {
  assert.equal(validName(" My résumé.pdf "), "My résumé.pdf");
  for (const input of ["", "  ", ".", "..", "a/b", "a\\b", "a\0b", "a\nb", "x".repeat(256)])
    assert.throws(() => validName(input), { code: "INVALID" });
  validScope({ type: "custom-plugin", id: "a/b" });
  for (const scope of [{ type: "", id: "id" }, { type: "a", id: " " }, null])
    assert.throws(() => validScope(scope), { code: "INVALID" });
  validId("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
  assert.throws(() => validId("forged"), { code: "INVALID" });
  for (const url of [
    "javascript:alert(1)",
    "data:text/plain,hi",
    "https://user:pass@host/",
    "//host/",
  ])
    assert.equal(safeDownloadUrl(url), undefined);
  assert.equal(
    safeDownloadUrl("https://storage.example/file?signature=short-lived"),
    "https://storage.example/file?signature=short-lived",
  );
});

test("Drive UI ships independently; only the companion contains storage dependencies", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  const ui = manifest.items.find((item) => item.name === "drive");
  const server = manifest.items.find((item) => item.name === "drive-storage");
  assert.deepEqual(ui.registryDependencies, [
    "@forge/cn",
    "@forge/ui-shims",
    "@forge/table-styles",
  ]);
  assert.deepEqual(ui.dependencies, ["@base-ui/react", "lucide-react"]);
  assert.deepEqual(server.registryDependencies, ["@forge/drive"]);
  assert.deepEqual(server.dependencies, [
    "drizzle-orm",
    "postgres",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ]);
  for (const item of [ui, server]) {
    assert.equal(item.type, "registry:block");
    const directory = `registry/components/plugins/drive${item === server ? "/server" : ""}`;
    const actual = (
      await readdir(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true })
    )
      .filter((entry) => entry.isFile())
      .map((entry) => `${directory}/${entry.name}`)
      .sort();
    assert.deepEqual(item.files.map((file) => file.path).sort(), actual);
    for (const file of item.files) {
      assert.equal(file.target, file.path.replace("registry/components/", "@components/"));
      const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /from ["'](?:next|@\/lib\/|@\/showroom\/)/);
      if (item === ui)
        assert.doesNotMatch(
          source,
          /plugins\/(?:customers|projects)|drive\/server|drizzle-orm|@aws-sdk|from "postgres"/,
        );
    }
  }
  const customers = manifest.items.find((item) => item.name === "customers");
  assert.ok(!customers.registryDependencies.includes("@forge/drive"));
});

test("Drive sorting validates fields, compares raw values and keeps unknown metadata last", () => {
  assert.deepEqual(validSort(), { field: "name", direction: "asc" });
  for (const sort of [
    null,
    {},
    { field: "name; DROP TABLE drive_entry", direction: "asc" },
    { field: "name", direction: "sideways" },
  ])
    assert.throws(() => validSort(sort), { code: "INVALID" });
  const items = [
    { name: "Unknown" },
    { name: "Large", size: 1200, updatedAt: "2026-09-15T12:00:00+02:00", owner: { name: "Zebra" } },
    { name: "Small", size: 90, updatedAt: "2026-09-15T09:30:00Z", owner: { name: "Acme" } },
    { name: "Empty", size: 0, updatedAt: "invalid" },
  ];
  const ordered = (field, direction) =>
    items
      .toSorted((a, b) => compareDriveItems(a, b, { field, direction }))
      .map((item) => item.name);
  assert.deepEqual(ordered("size", "asc"), ["Empty", "Small", "Large", "Unknown"]);
  assert.deepEqual(ordered("size", "desc"), ["Large", "Small", "Empty", "Unknown"]);
  assert.deepEqual(ordered("updatedAt", "asc"), ["Small", "Large", "Empty", "Unknown"]);
  assert.deepEqual(ordered("updatedAt", "desc"), ["Large", "Small", "Empty", "Unknown"]);
  assert.deepEqual(ordered("owner", "asc"), ["Small", "Large", "Empty", "Unknown"]);
  assert.deepEqual(ordered("owner", "desc"), ["Large", "Small", "Empty", "Unknown"]);
});
