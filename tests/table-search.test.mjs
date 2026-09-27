import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { matchesTableSearch } from "../registry/components/utils/table-search.ts";

test("table matching handles accents, multiple fields, numbers, blanks and missing values", () => {
  const values = ["Zoë Martin", "Human Resources", null, undefined, 0];
  assert.equal(matchesTableSearch(" ZOE resources ", ...values), true);
  assert.equal(matchesTableSearch("martin 0", ...values), true);
  assert.equal(matchesTableSearch("  ", ...values), true);
  assert.equal(matchesTableSearch("zoe designer", ...values), false);
});

test("table search ships its helper and every table plugin declares the dependency", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const item = items.find((item) => item.name === "table-search");
  const published = JSON.parse(await readFile("public/r/table-search.json", "utf8"));
  for (const file of item.files) {
    assert.equal(
      published.files.find((entry) => entry.path === file.path).content,
      await readFile(file.path, "utf8"),
    );
  }
  for (const name of [
    "employees",
    "customers",
    "projects",
    "blogs",
    "menus",
    "drive",
    "page-pricing-table",
  ]) {
    assert.ok(
      items.find((item) => item.name === name).registryDependencies.includes("@forge/table-search"),
      name,
    );
  }
});
