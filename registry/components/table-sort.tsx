"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import { cn } from "@/components/utils/cn";
import {
  initialSortDirection,
  nextTableSort,
  tableSortLabels,
  type TableSort,
  type TableSortProps,
} from "@/components/utils/table-sort-state";
import { tableHeaderClass } from "@/components/utils/table-styles";
import { viewPreferenceKey } from "@/components/utils/view-preference";

export type { TableSort, TableSortProps } from "@/components/utils/table-sort-state";

const emptySubscribe = () => () => {};

export function useTableSort<Field extends string>(
  { sort, onSortChange, sortLabels, sortStorageKey }: TableSortProps<Field>,
  defaultSort?: TableSort<Field>,
  isAvailable?: (field: Field) => boolean,
  preference?: { owner?: string; key: string; legacyKey?: string; fields: readonly Field[] },
) {
  const key =
    preference &&
    viewPreferenceKey(preference.owner ?? "table-sort", preference.key, "sort", sortStorageKey);
  const legacyKey =
    preference && `forge:table-sort:${sortStorageKey ?? preference.legacyKey ?? preference.key}`;
  const fields = preference?.fields;
  const [local, setLocal] = useState<{ key?: string; sort: TableSort<Field> }>();
  const restoredKey = useRef<string>(undefined);

  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const saved = useMemo(() => {
    if (!hydrated || !key || !legacyKey || !fields) return;
    try {
      const raw = window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey);
      if (raw)
        return z
          .object({ field: z.enum(fields), direction: z.enum(["asc", "desc"]) })
          .safeParse(JSON.parse(raw)).data;
    } catch {
      // Storage may be inaccessible or contain malformed JSON.
    }
  }, [hydrated, key, legacyKey, fields]);

  // Move an existing installation's saved order to its owning view.
  useEffect(() => {
    if (!hydrated || !key || !legacyKey) return;
    try {
      if (localStorage.getItem(legacyKey) === null) return;
      if (
        saved &&
        localStorage.getItem(key) === null &&
        !(saved.field === defaultSort?.field && saved.direction === defaultSort.direction)
      ) {
        localStorage.setItem(key, JSON.stringify(saved));
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // A read-only store can still supply its old preference.
    }
  }, [hydrated, key, legacyKey, saved, defaultSort]);

  // Restore once per visit. Later history navigation belongs to the host.
  useEffect(() => {
    if (!hydrated || restoredKey.current === key) return;
    if (!sort && saved && isAvailable && !isAvailable(saved.field)) return;
    restoredKey.current = key;
    if (!sort && saved) onSortChange?.(saved, "restore");
  }, [hydrated, key, saved, sort, onSortChange, isAvailable]);

  const localSort = local?.key === key ? local?.sort : undefined;
  const selected = onSortChange ? sort : (localSort ?? sort ?? saved);
  return {
    value: selected && isAvailable && !isAvailable(selected.field) ? undefined : selected,
    defaultSort,
    onValueChange: (next: TableSort<Field>) => {
      restoredKey.current = key;
      if (key) {
        try {
          if (next.field === defaultSort?.field && next.direction === defaultSort.direction) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          // Keep the choice active for this visit when persistence fails.
        }
      }
      if (onSortChange) onSortChange(next, "select");
      else setLocal({ key, sort: next });
    },
    labels: sortLabels,
  };
}

export interface TableSortHeaderProps<Field extends string> {
  field: Field;
  label: string;
  value?: TableSort<Field>;
  defaultSort?: TableSort<Field>;
  onValueChange?: (value: TableSort<Field>) => void;
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
          title={next.direction === "asc" ? labels.sortAscending : labels.sortDescending}
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
