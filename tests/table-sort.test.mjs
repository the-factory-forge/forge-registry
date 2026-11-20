import assert from "node:assert/strict";
import test from "node:test";

import {
  nextTableSort,
  resolveTableSort,
  sortTableRows,
} from "../registry/components/utils/table-sort-state.ts";

await test("an active header always reverses and keeps its field", () => {
  const name = { field: "name", direction: "asc" };
  const reversed = { ...name, direction: "desc" };
  const updated = { field: "updatedAt", direction: "desc" };
  for (const fallback of [undefined, updated]) {
    assert.deepEqual(
      resolveTableSort(undefined, fallback),
      fallback ?? { field: "id", direction: "asc" },
    );
    assert.deepEqual(nextTableSort("name", undefined, fallback), name);
    assert.deepEqual(nextTableSort("name", name, fallback), reversed);
    assert.deepEqual(nextTableSort("name", reversed, fallback), name);
  }
  assert.deepEqual(nextTableSort("updatedAt", name, updated), updated);
  const oldest = nextTableSort("updatedAt", undefined, updated);
  assert.deepEqual(oldest, { ...updated, direction: "asc" });
  assert.deepEqual(nextTableSort("updatedAt", oldest, updated), updated);
});

await test("ordering keeps empty cells last and resolves ties and initial unsorted rows by ID", () => {
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
