import { Link, useBlocker, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { forwardRef, useCallback, useMemo, useRef } from "react";
import { z } from "zod";

import type { LinkProps } from "@/components/link";
import type { TableSortProps } from "@/components/table-sort";

/** Host adapter: published components keep their framework-independent href contract. */
export const ShowroomLink = forwardRef<HTMLAnchorElement, LinkProps>(function ShowroomLink(
  { href, children, ...props },
  ref,
) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return (
      <a {...props} href={href} ref={ref}>
        {children}
      </a>
    );
  }
  const url = new URL(href, "https://showroom.invalid");
  return (
    <Link
      {...props}
      ref={ref}
      to={url.pathname}
      search={Object.fromEntries(url.searchParams)}
      hash={url.hash.slice(1)}
    >
      {children}
    </Link>
  );
});

export function useShowroomParams() {
  const { locale = "en", _splat } = useParams({ strict: false });
  return { locale, segments: _splat?.split("/").filter(Boolean) ?? [] };
}

export function useShowroomQuery() {
  const query: Record<string, unknown> = useLocation().search;
  const navigate = useNavigate();
  const update = (values: Record<string, string | number | boolean | undefined>, replace = false) =>
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, ...values }),
      hash: true,
      resetScroll: false,
      replace,
    });
  return { query, update };
}

export function useShowroomTableSort<Field extends string>(key: string, fields: readonly Field[]) {
  const { query, update } = useShowroomQuery();
  const raw = query[key + "Sort"];
  const sort = useMemo(() => {
    if (typeof raw !== "string") return;
    const result = z.tuple([z.enum(fields), z.enum(["asc", "desc"])]).safeParse(raw.split("."));
    if (result.success) return { field: result.data[0], direction: result.data[1] };
  }, [raw, fields]);
  const onSortChange: NonNullable<TableSortProps<Field>["onSortChange"]> = (next, source) =>
    update(
      {
        [key + "Sort"]: next.field + "." + next.direction,
        ...(source === "restore" ? {} : { [key + "Page"]: undefined }),
      },
      source === "restore",
    );
  return { sort, onSortChange };
}

export function useShowroomTablePage(key: string) {
  const { query, update } = useShowroomQuery();
  const page = z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(query[key + "Page"]);
  const search = z
    .string()
    .catch("")
    .parse(query[key + "Search"]);
  return {
    page,
    search,
    setPage: (next: number) => update({ [key + "Page"]: next > 1 ? next : undefined }),
    setSearch: (next: string) =>
      update({ [key + "Search"]: next || undefined, [key + "Page"]: undefined }, true),
  };
}

export function useShowroomEditorGuard(
  changesEditorView?: (current: Record<string, unknown>, next: Record<string, unknown>) => boolean,
) {
  const editorState = useRef({ dirty: false, pending: false });
  const onNavigationStateChange = useCallback((state: { dirty: boolean; pending: boolean }) => {
    editorState.current = state;
  }, []);
  // Block navigation during saves first; editors own dirty-edit dialogs and native unload.
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      editorState.current.pending &&
      (current.pathname !== next.pathname ||
        changesEditorView?.(current.search, next.search) === true),
    enableBeforeUnload: false,
  });
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      editorState.current.dirty &&
      (current.pathname !== next.pathname ||
        changesEditorView?.(current.search, next.search) === true),
    enableBeforeUnload: false,
    withResolver: true,
  });
  return {
    onNavigationStateChange,
    blockedNavigation: blocker.status === "blocked" ? blocker : undefined,
  };
}
