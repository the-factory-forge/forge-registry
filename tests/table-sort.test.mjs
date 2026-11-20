import assert from "node:assert/strict";
import test from "node:test";

import { nextTableSort, resolveTableSort } from "../registry/components/utils/table-sort-state.ts";

await test("a cleared column resolves to the configured default or ascending UUID", () => {
  const name = { field: "name", direction: "asc" };
  const reversed = { ...name, direction: "desc" };
  for (const fallback of [undefined, { field: "updatedAt", direction: "desc" }]) {
    assert.deepEqual(nextTableSort("name", undefined, fallback), name);
    assert.deepEqual(nextTableSort("name", name, fallback), reversed);
    const cleared = nextTableSort("name", reversed, fallback);
    assert.equal(cleared, undefined);
    assert.deepEqual(resolveTableSort(reversed, fallback), reversed);
    assert.deepEqual(
      resolveTableSort(cleared, fallback),
      fallback ?? { field: "id", direction: "asc" },
    );
  }
});
