"use client";

import { useEffect, useState } from "react";

import type { MenuCategory, MenuLabel, MenusClient } from "@/components/plugins/menus/types";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

type Taxonomy = { categories: MenuCategory[]; labelsData: MenuLabel[] };
/** Private session: MenuTaxonomyPage remounts it when the client changes. */
export function useMenuCategoriesAndLabels(client: MenusClient) {
  const [state, setState] = useState({
    revision: 0,
    data: undefined as Taxonomy | undefined,
    loading: true,
    error: false,
  });
  const optimistic = useOptimisticAction(state.data, client);
  useEffect(() => {
    let active = true;
    void Promise.all([client.categories(), client.labels()]).then(
      ([categories, labelsData]) => {
        if (active)
          setState((current) => ({
            ...current,
            data: { categories, labelsData },
            loading: false,
            error: false,
          }));
      },
      () => {
        if (active) setState((current) => ({ ...current, loading: false, error: true }));
      },
    );
    return () => {
      active = false;
    };
  }, [client, state.revision]);

  function mutate<T>(
    update: (current: Taxonomy) => Taxonomy,
    action: () => Promise<T>,
    accept: (current: Taxonomy, result: T) => Taxonomy,
  ) {
    if (state.loading || !state.data) return Promise.reject(new Error("Taxonomy is loading."));
    return optimistic.run(
      (current) => current && update(current),
      async () => {
        const result = await action();
        setState((current) => ({
          ...current,
          data: current.data && accept(current.data, result),
          revision: current.revision + 1,
          loading: true,
          error: false,
        }));
        return result;
      },
    );
  }
  return {
    data: optimistic.value,
    source: state.data,
    loading: state.loading,
    error: state.error,
    pending: optimistic.pending,
    mutationError: !!optimistic.error,
    refresh: () => {
      if (!optimistic.pending)
        setState((current) => ({
          ...current,
          revision: current.revision + 1,
          loading: true,
          error: false,
        }));
    },
    saveCategory: (input: Parameters<MenusClient["saveCategory"]>[0]) => {
      const id = input.id ?? `pending-${crypto.randomUUID()}`;
      return mutate(
        (current) => ({
          ...current,
          categories: input.id
            ? current.categories.map((row) => (row.id === id ? { ...row, ...input, id } : row))
            : [...current.categories, { ...input, id }],
        }),
        () => client.saveCategory(input),
        (current, result) => ({
          ...current,
          categories: [...current.categories.filter((row) => row.id !== result.id), result].sort(
            (a, b) => a.position - b.position,
          ),
        }),
      );
    },
    saveLabel: (input: Parameters<MenusClient["saveLabel"]>[0]) => {
      const id = input.id ?? `pending-${crypto.randomUUID()}`;
      return mutate(
        (current) => ({
          ...current,
          labelsData: input.id
            ? current.labelsData.map((row) => (row.id === id ? { ...row, ...input, id } : row))
            : [...current.labelsData, { ...input, id }],
        }),
        () => client.saveLabel(input),
        (current, result) => ({
          ...current,
          labelsData: [...current.labelsData.filter((row) => row.id !== result.id), result].sort(
            (a, b) => a.position - b.position,
          ),
        }),
      );
    },
    removeCategory: (id: string) => {
      const remove = (current: Taxonomy) => ({
        ...current,
        categories: current.categories.filter((row) => row.id !== id),
      });
      return mutate(remove, () => client.removeCategory(id), remove);
    },
    removeLabel: (id: string) => {
      const remove = (current: Taxonomy) => ({
        ...current,
        labelsData: current.labelsData.filter((row) => row.id !== id),
      });
      return mutate(remove, () => client.removeLabel(id), remove);
    },
  };
}
