"use client";

import { useEffect, useState, type RefObject } from "react";

import { useHistoryPublication } from "@/components/plugins/blogs/history";
import type { BlogsLabels } from "@/components/plugins/blogs/labels";
import type {
  BlogArticle,
  BlogContent,
  BlogHistoryHeader,
  BlogHistoryOrigin,
  BlogHistoryVersion,
  BlogShared,
  BlogsClient,
} from "@/components/plugins/blogs/types";
import { errorMessage, useBlogAction } from "@/components/plugins/blogs/ui";
import { emptyContent, hasUnpublishedChanges } from "@/components/plugins/blogs/utils";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

/** Private editor session: the owner remounts it when the article or language changes. */
export function useBlogDraft({
  client,
  article,
  locale,
  labels,
  navigationRef,
  onSaved,
  onDirtyChange,
}: {
  client: BlogsClient;
  article: BlogArticle;
  locale: string;
  labels: BlogsLabels;
  navigationRef: RefObject<(next: () => void) => void>;
  onSaved?: (article: BlogArticle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const action = useBlogAction(labels);
  const [base, setBase] = useState(article);
  const [content, setContent] = useState<BlogContent>(() => ({
    ...emptyContent,
    ...article.translations[locale]?.draft,
  }));
  const [shared, setShared] = useState<BlogShared>(() =>
    structuredClone(article.translations[locale]?.shared ?? article.shared),
  );
  const [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState<BlogHistoryOrigin>();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [historyResult, setHistoryResult] = useState<{
    client?: BlogsClient;
    version?: number;
    locale?: string;
    refresh?: number;
    headers: BlogHistoryHeader[];
    error?: unknown;
  }>({ headers: [] });
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodyResult, setBodyResult] = useState<{
    client: BlogsClient;
    version: number;
    id: string;
    refresh: number;
    value?: BlogHistoryVersion;
    error?: unknown;
  }>();
  const [compareWorking, setCompareWorking] = useState(false);
  const [historyMode, setHistoryMode] = useState<"read" | "compare">("read");
  const publication = useHistoryPublication(client, labels, accept);
  const pending = action.pending || publication.pending;
  const optimistic = useOptimisticAction<"draft" | "changed" | "published">(
    !base.translations[locale]?.published
      ? "draft"
      : hasUnpublishedChanges(base, locale)
        ? "changed"
        : "published",
    `${base.id}:${locale}:${base.version}`,
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    navigationRef.current = (next) => {
      if (pending) return;
      if (dirty) setLeave(() => next);
      else next();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      navigationRef.current = (next) => next();
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty, navigationRef, pending]);

  const historyLoading =
    !!client.history &&
    (historyResult.client !== client ||
      historyResult.version !== base.version ||
      historyResult.locale !== locale ||
      historyResult.refresh !== historyRefresh);
  const bodyLoading =
    !!selectedId &&
    (bodyResult?.id !== selectedId ||
      bodyResult.client !== client ||
      bodyResult.version !== base.version ||
      bodyResult.refresh !== historyRefresh);
  const selected =
    !bodyLoading && bodyResult?.id === selectedId ? (bodyResult.value ?? null) : null;

  useEffect(() => {
    if (!client.history) return;
    let active = true;
    void client.history.list({ id: base.id, locale }).then(
      (headers) => {
        if (active)
          setHistoryResult({
            client,
            version: base.version,
            locale,
            refresh: historyRefresh,
            headers,
          });
      },
      (error: unknown) => {
        if (active)
          setHistoryResult((previous) => ({
            ...previous,
            client,
            version: base.version,
            locale,
            refresh: historyRefresh,
            error,
          }));
      },
    );
    return () => {
      active = false;
    };
  }, [client, base.id, base.version, locale, historyRefresh]);

  useEffect(() => {
    if (!selectedId || !client.history) return;
    let active = true;
    void client.history.get({ id: base.id, locale, versionId: selectedId }).then(
      (value) => {
        if (active)
          setBodyResult({
            client,
            version: base.version,
            id: selectedId,
            refresh: historyRefresh,
            value,
          });
      },
      (error: unknown) => {
        if (active)
          setBodyResult({
            client,
            version: base.version,
            id: selectedId,
            refresh: historyRefresh,
            error,
          });
      },
    );
    return () => {
      active = false;
    };
  }, [client, base.id, base.version, locale, selectedId, historyRefresh]);

  function returnToDraft() {
    setSelectedId(null);
    setBodyResult(undefined);
    setCompareWorking(false);
  }
  function accept(result: BlogArticle) {
    setOrigin(undefined);
    returnToDraft();
    setBase(result);
    setContent({ ...emptyContent, ...result.translations[locale]?.draft });
    setShared(structuredClone(result.translations[locale]?.shared ?? result.shared));
    setDirty(false);
    onSaved?.(result);
  }
  async function save(continueNavigation = false) {
    if (pending) return false;
    const next = continueNavigation ? leave : null;
    const result = await action.run(
      JSON.stringify(["save", base.version, locale, content, shared, origin]),
      (requestId) =>
        optimistic.run(
          () => (base.translations[locale]?.published ? "changed" : "draft"),
          () =>
            client.save({
              id: base.id,
              version: base.version,
              locale,
              content,
              shared,
              origin,
              requestId,
            }),
        ),
      labels.saved,
    );
    if (!result) return false;
    accept(result);
    if (continueNavigation) {
      setLeave(null);
      next?.();
    }
    return true;
  }
  async function publish(remove = false) {
    if (pending || dirty) return;
    const versionId = base.translations[locale]?.history?.currentId;
    if (!remove && client.history && versionId) {
      await publication.prepare({ id: base.id, version: base.version, locale, versionId });
      return;
    }
    const result = await action.run(
      JSON.stringify([remove ? "unpublish" : "publish", base.version, locale]),
      (requestId) =>
        optimistic.run(
          () => (remove ? "draft" : "published"),
          () =>
            client[remove ? "unpublish" : "publish"]({
              id: base.id,
              version: base.version,
              locale,
              requestId,
            }),
        ),
      remove ? labels.unpublishedSuccess : labels.publishedSuccess,
    );
    if (result) accept(result);
  }
  function refresh() {
    return action.run("refresh-article", async () => {
      const latest = await client.get(base.id);
      if (dirty || selectedId) {
        setBase(latest);
        if (!dirty) {
          setContent({ ...emptyContent, ...latest.translations[locale]?.draft });
          setShared(structuredClone(latest.translations[locale]?.shared ?? latest.shared));
        }
      } else accept(latest);
      return true;
    });
  }

  return {
    base,
    content,
    shared,
    dirty,
    origin,
    pending,
    status: optimistic.value,
    feedback: action.feedback,
    publication,
    save,
    publish,
    refresh,
    editContent: <K extends keyof BlogContent>(key: K, value: BlogContent[K]) => {
      setContent((previous) => ({ ...previous, [key]: value }));
      setDirty(true);
    },
    editShared: <K extends keyof BlogShared>(key: K, value: BlogShared[K]) => {
      setShared((previous) => ({ ...previous, [key]: value }));
      setDirty(true);
    },
    upload: (file: File, target: "thumbnailId" | "bannerId" | "inline") => {
      return action.run(
        JSON.stringify(["upload", file.name, file.size, file.lastModified, target]),
        (requestId) => client.upload({ id: base.id, file, requestId }),
        labels.uploaded,
      );
    },
    leave: {
      requested: !!leave,
      cancel: () => {
        if (!pending) setLeave(null);
      },
      discard: () => {
        if (pending) return;
        const next = leave;
        accept(base);
        setLeave(null);
        next?.();
      },
    },
    history: {
      headers: historyResult.headers,
      loading: historyLoading,
      error:
        !historyLoading && historyResult.error
          ? errorMessage(historyResult.error, labels)
          : undefined,
      selectedId,
      selected,
      bodyLoading,
      bodyError:
        !bodyLoading && bodyResult?.error ? errorMessage(bodyResult.error, labels) : undefined,
      compareWorking,
      mode: historyMode,
      changeMode: (mode: "read" | "compare") => {
        setHistoryMode(mode);
      },
      retry: () => {
        setHistoryRefresh((value) => value + 1);
      },
      returnToDraft,
      compareDraft: () => {
        setHistoryMode("compare");
        setCompareWorking(true);
      },
      inspect: (header: BlogHistoryHeader, mode: "read" | "compare", onEntered: () => void) => {
        navigationRef.current(() => {
          setSelectedId(header.id);
          setHistoryMode(mode);
          setCompareWorking(false);
          onEntered();
        });
      },
      resume: (version: BlogHistoryVersion, onEntered: () => void) => {
        navigationRef.current(() => {
          setContent({ ...version.content });
          setShared(structuredClone(version.shared));
          setOrigin(
            version.state === "publication"
              ? { versionId: version.id, repriseId: crypto.randomUUID() }
              : { versionId: version.id },
          );
          returnToDraft();
          setDirty(true);
          onEntered();
        });
      },
      delete: async (version: BlogHistoryHeader, requestId: string) => {
        const result = await client.history!.delete({
          id: base.id,
          version: base.version,
          locale,
          versionId: version.id,
          requestId,
        });
        accept(result);
      },
    },
  };
}
