import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

void test("every tooltip importer ships its source and declares the portable dependency", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const tooltip = items.find((item) => item.name === "icon-tooltip");
  assert.deepEqual(tooltip.dependencies, ["@base-ui/react"]);
  for (const item of items) {
    for (const file of item.files ?? []) {
      if (!file.path.endsWith(".tsx")) continue;
      const source = await readFile(file.path, "utf8");
      if (source.includes('from "@/components/icon-tooltip"') || item === tooltip) {
        if (item !== tooltip)
          assert.ok(item.registryDependencies.includes("@forge/icon-tooltip"), item.name);
        const published = JSON.parse(await readFile(`public/r/${item.name}.json`, "utf8"));
        assert.equal(
          published.files.find((entry) => entry.path === file.path).content,
          source,
          file.path,
        );
      }
    }
  }
});
