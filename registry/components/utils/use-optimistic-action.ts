"use client";

import { QueryClient, QueryClientContext, useMutation } from "@tanstack/react-query";
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Completion belongs to a mounted owner, even if an earlier scope object is reused. */
export function useActionLifetime(scope?: unknown) {
  const identity = useMemo(() => ({ scope }), [scope]);
  const active = useRef<typeof identity | null>(null);
  useLayoutEffect(() => {
    active.current = identity;
    return () => {
      active.current = null;
    };
  }, [identity]);
  return {
    identity,
    isCurrent: () => active.current === identity,
    invalidate: () => {
      if (active.current === identity) active.current = null;
    },
  };
}

/** Overlay pending changes on host data without replacing its cache or fetch contract. */
export function useOptimisticAction<T>(value: T, scope?: unknown) {
  const inheritedClient = useContext(QueryClientContext);
  const [localClient] = useState(() => new QueryClient());
  const owner = useActionLifetime(scope);
  const lifetime = owner.identity;
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

  async function run<R>(
    update: (current: T) => T,
    action: () => Promise<R>,
    accept?: (result: R) => void,
  ): Promise<R> {
    if (lock.current === lifetime) throw new Error("An action is already pending.");
    lock.current = lifetime;
    try {
      const result = (await mutation.mutateAsync({
        update,
        source: value,
        scope: lifetime,
        action,
      })) as R;
      if (owner.isCurrent()) accept?.(result);
      return result;
    } finally {
      if (lock.current === lifetime) lock.current = null;
    }
  }

  return {
    value: optimistic && mutation.variables ? mutation.variables.update(value) : value,
    pending: current && mutation.isPending,
    error: current ? mutation.error : null,
    run,
    isCurrent: owner.isCurrent,
    invalidate: owner.invalidate,
  };
}

/** TanStack mutation state for commands whose optimistic data is owned by their caller. */
export function useMutationAction(scope?: unknown) {
  const mutation = useOptimisticAction(undefined, scope);
  async function run<R>(action: () => Promise<R>, accept?: (result: R) => void) {
    if (mutation.pending || !mutation.isCurrent()) return false;
    let accepted = false;
    try {
      await mutation.run(
        () => undefined,
        action,
        (result) => {
          accepted = true;
          accept?.(result);
        },
      );
    } catch {
      // TanStack retains the write error; obsolete owners expose no feedback.
    }
    return accepted;
  }
  return { pending: mutation.pending, error: mutation.error, isCurrent: mutation.isCurrent, run };
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
