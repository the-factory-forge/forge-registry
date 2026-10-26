"use client";

import { QueryClient, QueryClientContext, useMutation } from "@tanstack/react-query";
import { useContext, useMemo, useRef, useState } from "react";

/** Overlay pending changes on host data without replacing its cache or fetch contract. */
export function useOptimisticAction<T>(value: T, scope?: unknown) {
  const inheritedClient = useContext(QueryClientContext);
  const [localClient] = useState(() => new QueryClient());
  const lifetime = useMemo(() => ({ scope }), [scope]);
  const lock = useRef<typeof lifetime | null>(null);
  const mutation = useMutation(
    {
      mutationFn: (input: {
        update: (current: T) => T;
        source: T;
        scope: unknown;
        action: () => Promise<unknown>;
      }) => input.action(),
      retry: false,
      gcTime: 0,
      networkMode: "always",
    },
    inheritedClient ?? localClient,
  );
  const current = mutation.variables?.scope === lifetime;
  const optimistic =
    current && (mutation.isPending || (mutation.isSuccess && mutation.variables?.source === value));

  async function run<R>(update: (current: T) => T, action: () => Promise<R>): Promise<R> {
    if (lock.current === lifetime) throw new Error("An action is already pending.");
    lock.current = lifetime;
    try {
      return (await mutation.mutateAsync({ update, source: value, scope: lifetime, action })) as R;
    } finally {
      if (lock.current === lifetime) lock.current = null;
    }
  }

  return {
    value: optimistic && mutation.variables ? mutation.variables.update(value) : value,
    pending: current && mutation.isPending,
    error: current ? mutation.error : null,
    run,
  };
}

/** Keep row-owned dialogs mounted while an optimistic deletion hides their row. */
export function retainRemovedItems<T extends { id: string }>(
  items: readonly T[],
  source: readonly T[],
  pending: boolean,
): readonly T[] {
  if (!pending) return items;
  const ids = new Set(items.map((item) => item.id));
  return [...items, ...source.filter((item) => !ids.has(item.id))];
}
