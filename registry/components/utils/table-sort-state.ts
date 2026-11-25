export interface TableSort<Field extends string> {
  field: Field;
  direction: "asc" | "desc";
}

export interface TableSortProps<Field extends string> {
  sort?: TableSort<Field>;
  onSortChange?: (sort: TableSort<Field>, source?: "select" | "restore") => void;
  sortLabels?: Partial<typeof tableSortLabels>;
  /** Override the built-in key for independent instances of the same table. */
  sortStorageKey?: string;
}

export type TableSortValue = string | number | null | undefined;

/** Sort the complete result before taking a page. Empty cells stay last in both directions. */
export function sortTableRows<Row, Field extends string>(
  rows: readonly Row[],
  sort: TableSort<Field> | undefined,
  value: (row: Row, field: Field) => TableSortValue,
  id: (row: Row) => string,
  locale = "en",
) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return rows
    .map((row) => ({ row, key: sort && value(row, sort.field), id: id(row) }))
    .sort((a, b) => {
      const left = a.key ?? "",
        right = b.key ?? "";
      if ((left === "") !== (right === "")) return left === "" ? 1 : -1;
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : collator.compare(String(left), String(right));
      return (
        (sort?.direction === "desc" ? -comparison : comparison) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    })
    .map(({ row }) => row);
}

export const tableSortLabels = {
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  /** @deprecated Headers now toggle between ascending and descending. */
  sortClear: "Clear sort",
  /** @deprecated Headers now toggle between ascending and descending. */
  sortDefault: "Restore default order",
};

export function initialSortDirection(field: unknown, defaultSort?: TableSort<string>) {
  return defaultSort && field === defaultSort.field ? defaultSort.direction : "asc";
}

/** Use the effective order before paginating, including when no header is active. */
export function resolveTableSort<Field extends string>(
  value?: TableSort<Field>,
  defaultSort?: TableSort<Field>,
) {
  return value ?? defaultSort ?? ({ field: "id", direction: "asc" } as const);
}

export function nextTableSort<Field extends string>(
  field: Field,
  value?: TableSort<Field>,
  defaultSort?: TableSort<Field>,
): TableSort<Field> {
  const active = value ?? defaultSort;
  if (active?.field === field)
    return { field, direction: active.direction === "asc" ? "desc" : "asc" };
  return { field, direction: initialSortDirection(field, defaultSort) };
}
