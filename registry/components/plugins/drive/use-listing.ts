"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLoadingActivity } from "@/components/loading-indicator";
import type { DriveClient, DriveFolderResult, DriveScope } from "@/components/plugins/drive/types";
import { errorCode } from "@/components/plugins/drive/utils";

/** Private to Drive: callers memoize the read and keep refresh separate from mutation scope. */
export function useDriveListing<T>(
  load: (signal: AbortSignal) => Promise<T>,
  refreshKey: number | string,
  merge?: (previous: T | undefined, incoming: T) => T,
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
        if (!controller.signal.aborted)
          setResult((previous) => ({
            load,
            refreshKey,
            data: merge ? merge(previous?.data, data) : data,
            loadedAt: Date.now(),
          }));
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
  }, [load, refreshKey, merge]);

  const loading = result?.load !== load || result.refreshKey !== refreshKey;
  useLoadingActivity(loading);
  return {
    data: result?.data,
    loading,
    error: loading ? undefined : result?.error,
    loadedAt: result?.loadedAt,
  };
}

/** Tree pagination stays here; expansion and navigation belong to the tree. */
export function useDriveFolderListing(
  client: DriveClient,
  scope: DriveScope,
  parentId: string | null,
  refreshKey: number,
) {
  const generation = useMemo(
    () => ({ client, scope, parentId, refreshKey }),
    [client, scope, parentId, refreshKey],
  );
  const [page, setPage] = useState<{ generation: typeof generation; cursor?: string }>({
    generation,
  });
  if (page.generation !== generation) setPage({ generation });
  const cursor = page.generation === generation ? page.cursor : undefined;
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) =>
      generation.client.listEntries({
        scope: generation.scope,
        parentId: generation.parentId,
        cursor,
        signal,
      }),
    [generation, cursor],
  );
  const merge = useCallback(
    (previous: DriveFolderResult | undefined, incoming: DriveFolderResult): DriveFolderResult => {
      const folders = incoming.items.filter(
        (entry) => entry.kind === "folder" && entry.state === "ready",
      );
      return {
        ...incoming,
        items: cursor
          ? [
              ...(previous?.items ?? []),
              ...folders.filter((entry) => !previous?.items.some((old) => old.id === entry.id)),
            ]
          : folders,
      };
    },
    [cursor],
  );
  const listing = useDriveListing(load, revision, merge);
  return {
    ...listing,
    retry: () => setRevision((value) => value + 1),
    loadMore: () => {
      if (!listing.loading && !listing.error && listing.data?.nextCursor)
        setPage({ generation, cursor: listing.data.nextCursor });
    },
  };
}
