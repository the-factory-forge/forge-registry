import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import test from "node:test";

void test("registry toasts have one renderer and declare the shared dependencies", () => {
  for (const path of globSync("registry/components/**/*.tsx")) {
    if (path === "registry/components/action-toast.tsx") continue;
    assert.doesNotMatch(
      readFileSync(path, "utf8"),
      /<Toast\.(Provider|Portal|Root|Viewport)\b/,
      path,
    );
  }
  const { items } = JSON.parse(readFileSync("registry/registry.json", "utf8"));
  assert.ok(
    items
      .find((item) => item.name === "drive")
      .registryDependencies.includes("@forge/action-toast"),
  );
  assert.ok(
    items.find((item) => item.name === "action-toast").registryDependencies.includes("@forge/cn"),
  );
});
