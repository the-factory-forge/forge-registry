"use client";

import { useEffect, useState } from "react";

import { useLoadingActivity } from "@/components/loading-indicator";
import { errorCode } from "@/components/plugins/drive/utils";

/** Private to Drive: callers memoize the read and keep refresh separate from mutation scope. */
export function useDriveListing<T>(
  load: (signal: AbortSignal) => Promise<T>,
  refreshKey: number | string,
) {
  const [result, setResult] = useState<{
    load: typeof load;
    refreshKey: typeof refreshKey;
    data?: T;
    error?: unknown;
    loadedAt?: number;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted) setResult({ load, refreshKey, data, loadedAt: Date.now() });
      } catch (error) {
        if (controller.signal.aborted) return;
        const clear = ["FORBIDDEN", "NOT_FOUND"].includes(errorCode(error) ?? "");
        setResult((previous) => ({
          load,
          refreshKey,
          data: clear ? undefined : previous?.data,
          loadedAt: clear ? undefined : previous?.loadedAt,
          error,
        }));
      }
    })();
    return () => controller.abort();
  }, [load, refreshKey]);

  const loading = result?.load !== load || result.refreshKey !== refreshKey;
  useLoadingActivity(loading);
  return {
    data: result?.data,
    loading,
    error: loading ? undefined : result?.error,
    loadedAt: result?.loadedAt,
  };
}
