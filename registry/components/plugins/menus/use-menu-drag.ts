import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { MenuItem, MenuItemGroupOrder } from "@/components/plugins/menus/types";

export function moveMenuEntry(ids: readonly string[], id: string, target?: string, after = false) {
  if (id === target) return [...ids];
  const next = ids.filter((value) => value !== id);
  const index = target ? next.indexOf(target) : -1;
  next.splice(index < 0 ? next.length : index + Number(after), 0, id);
  return next;
}

type Session = {
  kind: "category" | "dish";
  id: string;
  categories: string[];
  groups: Record<string, string[]>;
  changed: boolean;
  x: number;
  y: number;
};

/** Preview locally while hovering; persist one versioned move only after dropping. */
export function useMenuDrag(
  categoryIds: readonly string[],
  items: readonly MenuItem[],
  canEdit: (id: string) => boolean,
  commitCategories: (ids: string[]) => Promise<unknown>,
  commitItems: (groups: MenuItemGroupOrder[]) => Promise<unknown>,
) {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hovered = useRef("");
  const committing = useRef(false);
  const pointer = useRef<{
    id: number;
    kind: Session["kind"];
    entry: string;
    x: number;
    y: number;
    root: Element;
    active: boolean;
  } | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function update(next: Session | null) {
    current.current = next;
    setSession(next);
  }
  function cancelHover() {
    clearTimeout(timer.current);
    hovered.current = "";
  }
  function end() {
    if (committing.current) return;
    pointer.current = null;
    cancelHover();
    update(null);
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  function start(kind: Session["kind"], id: string, x = 0, y = 0) {
    cancelHover();
    update({
      kind,
      id,
      categories: [...categoryIds],
      groups: Object.fromEntries(
        categoryIds.map((categoryId) => [
          categoryId,
          items
            .filter((item) => item.categoryId === categoryId)
            .sort((a, b) => a.position - b.position)
            .map((item) => item.id),
        ]),
      ),
      changed: false,
      x,
      y,
    });
  }
  function preview(categoryId: string, target?: string, after = false) {
    const value = current.current;
    if (!value) return;
    if (value.kind === "category") {
      if (value.id === categoryId) return;
      update({
        ...value,
        categories: moveMenuEntry(value.categories, value.id, categoryId, after),
        changed: true,
      });
    } else {
      const original = items.find((item) => item.id === value.id);
      if (
        !original ||
        original.categoryId === null ||
        !canEdit(original.categoryId) ||
        !canEdit(categoryId) ||
        value.id === target
      )
        return;
      const groups = Object.fromEntries(
        Object.entries(value.groups).map(([id, entries]) => [
          id,
          entries.filter((id) => id !== value.id),
        ]),
      );
      groups[categoryId] = moveMenuEntry(groups[categoryId] ?? [], value.id, target, after);
      update({ ...value, groups, changed: true });
    }
  }
  function hover(categoryId: string, target?: string, after = false) {
    const value = current.current;
    if (!value || value.id === (value.kind === "category" ? categoryId : target)) return;
    if (value.kind === "dish" && !canEdit(categoryId)) return;
    const key = `${categoryId}:${target ?? ""}:${after}`;
    if (hovered.current === key) return;
    cancelHover();
    hovered.current = key;
    timer.current = setTimeout(() => preview(categoryId, target, after), 280);
  }
  async function drop(categoryId: string, target?: string, after = false) {
    cancelHover();
    if (!current.current) return;
    if (current.current.kind === "dish" && !canEdit(categoryId)) {
      end();
      return;
    }
    if (!current.current.changed) preview(categoryId, target, after);
    const value = current.current;
    if (!value?.changed) {
      end();
      return;
    }
    committing.current = true;
    try {
      if (value.kind === "category") {
        if (value.categories.join() !== categoryIds.join())
          await commitCategories(value.categories);
      } else {
        const groups = Object.entries(value.groups)
          .filter(
            ([categoryId, ids]) =>
              ids.join() !==
              items
                .filter((item) => item.categoryId === categoryId)
                .sort((a, b) => a.position - b.position)
                .map((item) => item.id)
                .join(),
          )
          .map(([categoryId, ids]) => ({
            categoryId,
            items: ids.map((id) => ({
              id,
              version: items.find((item) => item.id === id)!.version,
            })),
          }));
        if (groups.length) await commitItems(groups);
      }
    } finally {
      committing.current = false;
      end();
    }
  }
  function destination(event: PointerEvent) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const category = target?.closest<HTMLElement>("[data-menu-category]");
    if (!category || !pointer.current?.root.contains(category)) return null;
    const categoryId = category.dataset.menuCategory!;
    if (current.current?.kind === "category") {
      const box = category.getBoundingClientRect();
      return { categoryId, after: event.clientY > box.top + box.height / 2 };
    }
    const dish = target?.closest<HTMLElement>("[data-menu-dish]");
    if (dish) {
      const box = dish.getBoundingClientRect();
      return {
        categoryId,
        target: dish.dataset.menuDish,
        after: event.clientY > box.top + box.height / 2,
      };
    }
    if (target?.closest("[data-menu-drag-placeholder]")) return null;
    return { categoryId };
  }
  function pointerMove(event: PointerEvent) {
    const value = pointer.current;
    if (!value || value.id !== event.pointerId) return;
    if (!value.active) {
      if (Math.hypot(event.clientX - value.x, event.clientY - value.y) < 6) return;
      value.active = true;
      start(value.kind, value.entry, event.clientX, event.clientY);
    }
    event.preventDefault();
    const next = current.current;
    if (next) update({ ...next, x: event.clientX, y: event.clientY });
    const target = destination(event);
    if (target && (value.kind === "category" || canEdit(target.categoryId)))
      hover(target.categoryId, target.target, target.after);
    else cancelHover();
    const top =
      parseFloat(getComputedStyle(value.root).getPropertyValue("--menu-workspace-top")) || 80;
    if (event.clientY < top + 40) window.scrollBy(0, -20);
    else if (event.clientY > innerHeight - 40) window.scrollBy(0, 20);
  }
  function handle(kind: Session["kind"], id: string) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || committing.current) return;
        const root = event.currentTarget.closest("[data-menu-workspace-section]");
        if (!root) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = {
          id: event.pointerId,
          kind,
          entry: id,
          x: event.clientX,
          y: event.clientY,
          root,
          active: false,
        };
      },
      onPointerMove: pointerMove,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const value = pointer.current;
        if (!value || value.id !== event.pointerId) return;
        const target = destination(event);
        if (value.active && current.current) {
          if (target) void drop(target.categoryId, target.target, target.after);
          else if (
            current.current.changed &&
            value.root.contains(document.elementFromPoint(event.clientX, event.clientY))
          )
            void drop(
              value.kind === "dish"
                ? (Object.keys(current.current.groups).find((id) =>
                    current.current?.groups[id].includes(value.entry),
                  ) ?? current.current.categories[0])
                : current.current.categories[0],
            );
          else end();
        } else end();
        pointer.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: end,
      onLostPointerCapture: () => {
        if (pointer.current) end();
      },
    };
  }
  return { session, handle, categories: session?.categories ?? categoryIds };
}
