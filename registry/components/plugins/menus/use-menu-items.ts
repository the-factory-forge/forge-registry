"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { MenuCategory, MenuItem, MenusClient } from "@/components/plugins/menus/types";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

function initialState(client: MenusClient, generation = 0) {
  return {
    scope: { client, generation },
    revision: 0,
    data: undefined as { items: MenuItem[]; categories: MenuCategory[] } | undefined,
    loading: true,
    error: false,
    reordering: false,
    orderError: false,
  };
}

/** Keep confirmed deletion sessions mounted while accepting results only for their list. */
export function useMenuItems(client: MenusClient) {
  const [state, setState] = useState(() => initialState(client));
  if (state.scope.client !== client) setState(initialState(client, state.scope.generation + 1));
  const { scope } = state;
  const currentScope = useRef<typeof scope | null>(scope);
  const optimistic = useOptimisticAction(state.data, scope);
  const reorderLock = useRef(false);
  const update = (change: (current: typeof state) => typeof state) =>
    setState((current) => (current.scope === scope ? change(current) : current));

  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => {
      currentScope.current = null;
    };
  }, [scope]);
  useEffect(() => {
    let active = true;
    void Promise.all([scope.client.list(), scope.client.categories()]).then(
      ([items, categories]) => {
        if (active)
          setState((current) =>
            current.scope === scope
              ? {
                  ...current,
                  data: {
                    items: [...items].sort(
                      (a, b) => a.position - b.position || a.id.localeCompare(b.id),
                    ),
                    categories,
                  },
                  loading: false,
                  error: false,
                }
              : current,
          );
      },
      () => {
        if (active)
          setState((current) =>
            current.scope === scope ? { ...current, loading: false, error: true } : current,
          );
      },
    );
    return () => {
      active = false;
    };
  }, [scope, state.revision]);

  async function removeItem(id: string, refresh: boolean) {
    await scope.client.remove(id);
    update((current) => ({
      ...current,
      data: current.data && {
        ...current.data,
        items: current.data.items.filter((item) => item.id !== id),
      },
      revision: current.revision + (refresh ? 1 : 0),
      loading: refresh || current.loading,
    }));
  }

  return {
    scope: scope.generation,
    data: optimistic.value,
    source: state.data,
    loading: state.loading,
    error: state.error,
    pending: optimistic.pending,
    reordering: state.reordering,
    mutationError: state.orderError || !!optimistic.error,
    refresh: () => {
      if (!optimistic.pending)
        update((current) => ({
          ...current,
          revision: current.revision + 1,
          loading: true,
          error: false,
        }));
    },
    move: async (id: string, to: number) => {
      if (
        !state.data ||
        !scope.client.reorder ||
        state.loading ||
        state.error ||
        optimistic.pending ||
        reorderLock.current
      )
        return false;
      const ordered = [...state.data.items];
      const from = ordered.findIndex((item) => item.id === id);
      if (from < 0 || to < 0 || to >= ordered.length || from === to) return false;
      ordered.splice(to, 0, ...ordered.splice(from, 1));
      reorderLock.current = true;
      update((current) => ({ ...current, reordering: true, orderError: false }));
      try {
        await optimistic.run(
          (current) => current && { ...current, items: ordered },
          async () => {
            const items = await scope.client.reorder!(
              ordered.map(({ id, version }) => ({ id, version })),
            );
            update((current) => ({
              ...current,
              data: current.data && { ...current.data, items },
              reordering: false,
            }));
          },
        );
        return currentScope.current === scope;
      } catch {
        update((current) => ({
          ...current,
          reordering: false,
          orderError: true,
          loading: true,
          revision: current.revision + 1,
        }));
        return false;
      } finally {
        reorderLock.current = false;
      }
    },
    remove: (id: string) =>
      optimistic.run(
        (current) =>
          current && { ...current, items: current.items.filter((item) => item.id !== id) },
        () => removeItem(id, true),
      ),
    // The deletion session already owns optimism and serializes the confirmed batch.
    removeSelected: (id: string) => removeItem(id, false),
  };
}
