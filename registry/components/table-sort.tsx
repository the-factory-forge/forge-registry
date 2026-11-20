"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/utils/cn";
import {
  initialSortDirection,
  nextTableSort,
  tableSortLabels,
  type TableSort,
  type TableSortProps,
} from "@/components/utils/table-sort-state";
import { tableHeaderClass } from "@/components/utils/table-styles";

export type { TableSort, TableSortProps } from "@/components/utils/table-sort-state";

/** A host can own the selection in its URL, or use the local state for a complete collection. */
export function useTableSort<Field extends string>(
  { sort, onSortChange, sortLabels }: TableSortProps<Field>,
  defaultSort?: TableSort<Field>,
  isAvailable?: (field: Field) => boolean,
) {
  const [local, setLocal] = useState(sort);
  const selected = onSortChange ? sort : local;
  return {
    value: selected && isAvailable && !isAvailable(selected.field) ? undefined : selected,
    defaultSort,
    onValueChange: onSortChange ?? setLocal,
    labels: sortLabels,
  };
}

export interface TableSortHeaderProps<Field extends string> {
  field: Field;
  label: string;
  value?: TableSort<Field>;
  defaultSort?: TableSort<Field>;
  onValueChange?: (value: TableSort<Field> | undefined) => void;
  labels?: Partial<typeof tableSortLabels>;
  className?: string;
}

export function TableSortHeader<Field extends string>({
  field,
  label,
  value,
  defaultSort,
  onValueChange,
  labels: overrides,
  className,
}: TableSortHeaderProps<Field>) {
  const labels = { ...tableSortLabels, ...overrides };
  const active = value ?? defaultSort;
  const selected = active?.field === field;
  const direction = selected ? active.direction : initialSortDirection(field, defaultSort);
  const Arrow = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const next = nextTableSort(field, value, defaultSort);
  const content = (
    <>
      {label}
      {(selected || onValueChange) && (
        <Arrow
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            !selected &&
              "opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100",
          )}
        />
      )}
    </>
  );
  return (
    <th
      scope="col"
      className={cn(tableHeaderClass, className)}
      aria-sort={selected ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      {onValueChange ? (
        <button
          type="button"
          className="group/sort inline-flex min-h-10 w-full cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring in-[.text-right]:justify-end"
          title={
            next
              ? next.direction === "asc"
                ? labels.sortAscending
                : labels.sortDescending
              : defaultSort
                ? labels.sortDefault
                : labels.sortClear
          }
          onClick={() => onValueChange(next)}
        >
          {content}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">{content}</span>
      )}
    </th>
  );
}
