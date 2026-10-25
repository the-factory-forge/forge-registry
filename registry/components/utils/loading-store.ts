/** One activity queue per app; completed work remains visible for 300ms. */
export function createLoadingStore() {
  const active = new Set<symbol>();
  const listeners = new Set<() => void>();
  let state: "idle" | "loading" | "complete" = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  function publish(next: typeof state) {
    if (state === next) return;
    state = next;
    listeners.forEach((listener) => listener());
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => "idle" as const,
    start() {
      clearTimeout(timer);
      const token = Symbol();
      active.add(token);
      publish("loading");
      return () => {
        if (!active.delete(token) || active.size) return;
        publish("complete");
        timer = setTimeout(() => publish("idle"), 300);
      };
    },
    dispose() {
      clearTimeout(timer);
      active.clear();
      publish("idle");
    },
  };
}
