export interface TableSort<Field extends string> {
  field: Field;
  direction: "asc" | "desc";
}

export const tableSortLabels = {
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  sortClear: "Clear sort",
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
): TableSort<Field> | undefined {
  const active = value ?? defaultSort;
  const first = initialSortDirection(field, defaultSort);
  if (active?.field !== field) return { field, direction: first };
  if (active.direction === first) return { field, direction: first === "asc" ? "desc" : "asc" };
  return undefined;
}
