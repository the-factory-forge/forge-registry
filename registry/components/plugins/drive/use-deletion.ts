"use client";

import { useEffect, useRef, useState } from "react";

import type { DriveClient, DriveScope } from "@/components/plugins/drive/types";
import { errorCode } from "@/components/plugins/drive/utils";

interface DeletionCount {
  id: string;
  files: number;
  folders: number;
}

export function useDriveDeletion(client: DriveClient, scope: DriveScope) {
  const current = useRef<
    | {
        request: Promise<DeletionCount[]>;
        tokens: Map<string, string>;
      }
    | undefined
  >(undefined);
  const [state, setState] = useState<{
    counts?: DeletionCount[];
    loading: boolean;
    error?: unknown;
  }>({ loading: true });

  useEffect(
    () => () => {
      current.current = undefined;
    },
    [],
  );

  function prepare(ids: readonly string[]) {
    const tokens = new Map<string, string>();
    const request = Promise.all(
      ids.map(async (id) => {
        const preview = await client.previewDelete({ scope, entryId: id });
        tokens.set(id, preview.token);
        return { id, files: preview.files, folders: preview.folders };
      }),
    );
    const attempt = { request, tokens };
    current.current = attempt;
    setState({ loading: true });
    void request.then(
      (counts) => {
        if (current.current === attempt) setState({ counts, loading: false });
      },
      (error: unknown) => {
        if (current.current !== attempt) return;
        current.current = undefined;
        setState({ error, loading: false });
      },
    );
    return request;
  }

  return {
    ...state,
    prepare,
    reset() {
      current.current = undefined;
      setState({ loading: false });
    },
    async remove(id: string, trashing: boolean) {
      if (!current.current) void prepare([id]);
      const attempt = current.current!;
      await attempt.request;
      const token = attempt.tokens.get(id);
      if (!token) throw new Error("Deletion preview is unavailable");
      try {
        const input = { scope, entryId: id, token };
        if (trashing) await client.trashEntry!(input);
        else await client.deleteEntry(input);
      } catch (error) {
        if (errorCode(error) === "CONFLICT") {
          attempt.tokens.delete(id);
          if (current.current === attempt) {
            if (!attempt.tokens.size) current.current = undefined;
            setState((previous) => ({
              ...previous,
              counts: previous.counts?.filter((count) => count.id !== id),
            }));
          }
        }
        throw error;
      }
    },
  };
}
