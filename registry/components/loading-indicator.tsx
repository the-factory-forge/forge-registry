"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { cn } from "@/components/utils/cn";
import { createLoadingStore } from "@/components/utils/loading-store";

const LoadingContext = createContext<ReturnType<typeof createLoadingStore> | null>(null);

export interface LoadingProviderProps {
  children: ReactNode;
}

/** Place one provider around the app and one indicator below its navbar. */
export function LoadingProvider({ children }: LoadingProviderProps) {
  const inherited = useContext(LoadingContext);
  const [local] = useState(createLoadingStore);
  useEffect(() => () => local.dispose(), [local]);
  return <LoadingContext.Provider value={inherited ?? local}>{children}</LoadingContext.Provider>;
}

/** Report the real loading state; cleanup releases it on cancellation or unmount. */
export function useLoadingActivity(loading: boolean) {
  const store = useContext(LoadingContext);
  useEffect(() => {
    if (loading) return store?.start();
  }, [loading, store]);
}

/** Track imperative actions too, including promises that resolve before a render. */
export function useLoadingTask() {
  const store = useContext(LoadingContext);
  const pending = useRef(new Set<() => void>());
  useEffect(() => {
    const tasks = pending.current;
    return () => {
      tasks.forEach((finish) => finish());
      tasks.clear();
    };
  }, [store]);
  return useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      const finish = store?.start();
      if (finish) pending.current.add(finish);
      try {
        return await task();
      } finally {
        finish?.();
        if (finish) pending.current.delete(finish);
      }
    },
    [store],
  );
}

export interface LoadingIndicatorProps {
  label?: string;
  className?: string;
}

export function LoadingIndicator({ label = "Loading…", className }: LoadingIndicatorProps) {
  const store = useContext(LoadingContext);
  return store ? <ActivityBar store={store} label={label} className={className} /> : null;
}

function ActivityBar({
  store,
  label,
  className,
}: LoadingIndicatorProps & { store: ReturnType<typeof createLoadingStore> }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <div
      data-slot="loading-indicator"
      data-state={state}
      hidden={state === "idle"}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[1100] h-1 overflow-hidden bg-primary/20 print:hidden",
        className,
      )}
    >
      <progress aria-label={label} className="sr-only" />
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          [data-slot="loading-indicator"] > div {
            transform: scaleX(0.9);
            transition: transform 8s ease-out;
          }
          [data-slot="loading-indicator"][data-state="complete"] > div {
            transform: scaleX(1);
            transition: transform 300ms linear;
          }
          @starting-style {
            [data-slot="loading-indicator"] > div,
            [data-slot="loading-indicator"][data-state="complete"] > div {
              transform: scaleX(0);
            }
          }
        }
      `}</style>
      <div aria-hidden="true" className="h-full w-full origin-left bg-primary" />
    </div>
  );
}
