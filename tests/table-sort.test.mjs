import assert from "node:assert/strict";
import test from "node:test";

import {
  nextTableSort,
  resolveTableSort,
  sortTableRows,
} from "../registry/components/utils/table-sort-state.ts";

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

await test("ordering keeps empty cells last and resolves ties and cleared sorts by ID", () => {
  const rows = [
    { id: "c", name: "Item 2" },
    { id: "a", name: "Item 10" },
    { id: "d", name: null },
    { id: "b", name: "ITEM 2" },
  ];
  const sorted = (direction) =>
    sortTableRows(
      rows,
      direction && { field: "name", direction },
      (row, field) => row[field],
      (row) => row.id,
    ).map((row) => row.id);
  assert.deepEqual(sorted("asc"), ["b", "c", "a", "d"]);
  assert.deepEqual(sorted("desc"), ["a", "b", "c", "d"]);
  assert.deepEqual(sorted(undefined), ["a", "b", "c", "d"]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["c", "a", "d", "b"],
  );
});
