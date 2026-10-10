"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRightIcon, FolderIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveBrowserProps,
  DriveEntry,
  DriveFolderResult,
} from "@/components/plugins/drive/types";
import { DriveFeedback, messageFor } from "@/components/plugins/drive/ui";
import { errorCode } from "@/components/plugins/drive/utils";
import { sidebarNavActiveClass, sidebarNavItemClass } from "@/components/sidebar-navigation";
import { cn } from "@/components/utils/cn";

type FolderTreeProps = Pick<DriveBrowserProps, "client" | "scope" | "getFolderHref"> & {
  parentId: string | null;
  currentFolderId: string | null;
  breadcrumbs: DriveFolderResult["breadcrumbs"];
  labels: DriveLabels;
  linkComponent: NonNullable<DriveBrowserProps["linkComponent"]>;
  onNavigate: () => void;
  refreshKey: number;
  filesActive: boolean;
};

export function DriveFolderTree(props: FolderTreeProps) {
  const { client, scope, parentId, labels, refreshKey } = props;
  const [page, setPage] = useState<{ refreshKey: number; cursor?: string }>({ refreshKey });
  if (page.refreshKey !== refreshKey) setPage({ refreshKey });
  const cursor = page.refreshKey === refreshKey ? page.cursor : undefined;
  const [revision, setRevision] = useState(0);
  const request = useMemo(
    () => ({ client, scope, parentId, cursor, revision, refreshKey }),
    [client, scope, parentId, cursor, revision, refreshKey],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    entries: Pick<DriveEntry, "id" | "name">[];
    nextCursor?: string;
    error?: unknown;
  }>();
  const loading = result?.request !== request;
  const error = loading ? undefined : result?.error;
  const nextCursor = result?.nextCursor;
  const lock = useRef(false);
  const entries = result?.entries ?? [];
  const parentIndex = props.breadcrumbs.findIndex((crumb) => crumb.id === parentId);
  const ancestor =
    parentId === null
      ? props.breadcrumbs[0]
      : parentIndex >= 0
        ? props.breadcrumbs[parentIndex + 1]
        : undefined;
  const visibleEntries =
    !error && ancestor && !entries.some((entry) => entry.id === ancestor.id)
      ? [...entries, ancestor]
      : entries;

  useEffect(() => {
    const controller = new AbortController();
    void client
      .listEntries({ scope, parentId, cursor, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const folders = data.items.filter(
          (entry) => entry.kind === "folder" && entry.state === "ready",
        );
        setResult((previous) => ({
          request,
          entries: cursor
            ? [
                ...(previous?.entries ?? []),
                ...folders.filter((entry) => !previous?.entries.some((old) => old.id === entry.id)),
              ]
            : folders,
          nextCursor: data.nextCursor,
        }));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setResult((previous) => ({
          request,
          error: reason,
          entries: ["FORBIDDEN", "NOT_FOUND"].includes(errorCode(reason) ?? "")
            ? []
            : (previous?.entries ?? []),
        }));
      })
      .finally(() => {
        if (!controller.signal.aborted) lock.current = false;
      });
    return () => controller.abort();
  }, [client, scope, parentId, cursor, request]);

  return (
    <div aria-busy={loading}>
      <ul className="space-y-0.5">
        {visibleEntries.map((entry) => (
          <FolderNode key={entry.id} {...props} entry={entry} />
        ))}
      </ul>
      <div className="flex h-10 items-center gap-1 px-2 md:h-8">
        {loading ? (
          <div className="min-w-0 [&>p]:truncate">
            <DriveFeedback message={labels.loading} />
          </div>
        ) : error ? (
          <>
            <p role="alert" className="min-w-0 flex-1 truncate text-sm text-destructive">
              {messageFor(error, labels)}
            </p>
            <IconTooltip label={`${messageFor(error, labels)} ${labels.retry}`}>
              <button
                type="button"
                aria-label={`${messageFor(error, labels)} ${labels.retry}`}
                className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring md:size-8"
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCwIcon className="size-4" aria-hidden="true" />
              </button>
            </IconTooltip>
          </>
        ) : nextCursor ? (
          <button
            type="button"
            className={sidebarNavItemClass}
            disabled={loading}
            onClick={() => {
              if (loading || lock.current) return;
              lock.current = true;
              setPage({ refreshKey, cursor: nextCursor });
            }}
          >
            <span className="truncate">{labels.loadMoreFolders}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FolderNode({
  entry,
  ...props
}: FolderTreeProps & { entry: Pick<DriveEntry, "id" | "name"> }) {
  const {
    currentFolderId,
    breadcrumbs,
    filesActive,
    labels,
    getFolderHref,
    linkComponent: HostLink,
    onNavigate,
  } = props;
  const active =
    filesActive &&
    (entry.id === currentFolderId || breadcrumbs.some((crumb) => crumb.id === entry.id));
  const [expansion, setExpansion] = useState({ active, open: active });
  if (expansion.active !== active) setExpansion({ active, open: expansion.open || active });
  const open = expansion.open;
  const toggleLabel = `${open ? labels.collapseFolder : labels.expandFolder}: ${entry.name}`;
  return (
    <li>
      <Collapsible.Root open={open} onOpenChange={(open) => setExpansion({ active, open })}>
        <div className="flex items-center gap-1">
          <IconTooltip label={toggleLabel}>
            <Collapsible.Trigger
              aria-label={toggleLabel}
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring md:size-8"
            >
              <ChevronRightIcon
                className={cn(
                  "size-4 transition-transform motion-reduce:transition-none",
                  open && "rotate-90",
                )}
                aria-hidden="true"
              />
            </Collapsible.Trigger>
          </IconTooltip>
          <HostLink
            href={getFolderHref(entry.id)}
            aria-label={`${labels.folder}: ${entry.name}`}
            aria-current={filesActive && entry.id === currentFolderId ? "page" : undefined}
            className={cn(sidebarNavItemClass, "min-w-0 flex-1", active && sidebarNavActiveClass)}
            onClick={(event) => {
              if (
                !event.defaultPrevented &&
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              )
                onNavigate();
            }}
          >
            <FolderIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{entry.name}</span>
          </HostLink>
        </div>
        <Collapsible.Panel>
          <div className="ml-4 border-l border-sidebar-border pl-2">
            {open && <DriveFolderTree {...props} parentId={entry.id} />}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}
