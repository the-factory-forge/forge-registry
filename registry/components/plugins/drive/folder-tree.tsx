"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveBrowserProps,
  DriveEntry,
  DriveFolderResult,
} from "@/components/plugins/drive/types";
import { DriveFeedback, DriveFolderIcon, messageFor } from "@/components/plugins/drive/ui";
import { useDriveFolderListing } from "@/components/plugins/drive/use-listing";
import { sidebarNavActiveClass, sidebarNavItemClass } from "@/components/sidebar-navigation";
import { cn } from "@/components/utils/cn";

type FolderTreeProps = Pick<DriveBrowserProps, "client" | "scope" | "getFolderHref"> & {
  parentId: string | null;
  currentFolderId: string | null;
  breadcrumbs: DriveFolderResult["breadcrumbs"];
  labels: DriveLabels;
  linkComponent: NonNullable<DriveBrowserProps["linkComponent"]>;
  onNavigate: () => void;
  onLoadingChange: (loading: boolean) => void;
  refreshKey: number;
  filesActive: boolean;
  renderActions: (entry: DriveEntry, disabled: boolean) => ReactNode;
};

export function DriveFolderTree(props: FolderTreeProps) {
  const { client, scope, parentId, labels, refreshKey, onLoadingChange } = props;
  const { data, loading, error, retry, loadMore } = useDriveFolderListing(
    client,
    scope,
    parentId,
    refreshKey,
  );
  useEffect(() => onLoadingChange(loading), [loading, onLoadingChange]);
  const nextCursor = data?.nextCursor;
  const entries = data?.items ?? [];
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

  return (
    <div aria-busy={loading}>
      <ul className="space-y-0.5">
        {visibleEntries.map((entry) => (
          <FolderNode key={entry.id} {...props} entry={entry} disabled={loading || !!error} />
        ))}
      </ul>
      {loading && (
        <div className="sr-only">
          <DriveFeedback message={labels.loading} />
        </div>
      )}
      {(!!error || !!nextCursor) && (
        <div className="flex h-10 items-center gap-1 px-2 md:h-8">
          {error ? (
            <>
              <p role="alert" className="min-w-0 flex-1 truncate text-sm text-destructive">
                {messageFor(error, labels)}
              </p>
              <IconTooltip label={`${messageFor(error, labels)} ${labels.retry}`}>
                <button
                  type="button"
                  aria-label={`${messageFor(error, labels)} ${labels.retry}`}
                  className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring md:size-8"
                  onClick={retry}
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
              onClick={loadMore}
            >
              <span className="truncate">{labels.loadMoreFolders}</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FolderNode({
  entry,
  disabled,
  ...props
}: FolderTreeProps & {
  entry: DriveEntry | DriveFolderResult["breadcrumbs"][number];
  disabled: boolean;
}) {
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
  const [loading, setLoading] = useState(true);
  const toggleLabel = `${open ? labels.collapseFolder : labels.expandFolder}: ${entry.name}`;
  return (
    <li>
      <Collapsible.Root open={open} onOpenChange={(open) => setExpansion({ active, open })}>
        <div className="group/drive-folder-row flex items-center gap-1">
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
            className={cn(
              sidebarNavItemClass,
              "group/drive-folder min-w-0 flex-1",
              active && sidebarNavActiveClass,
            )}
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
            <DriveFolderIcon open={open || active} loading={open && loading} />
            <span className="min-w-0 wrap-anywhere">{entry.name}</span>
          </HostLink>
          {"kind" in entry && props.renderActions(entry, disabled)}
        </div>
        <Collapsible.Panel>
          <div className="ml-4 border-l border-sidebar-border pl-2">
            {open && (
              <DriveFolderTree {...props} parentId={entry.id} onLoadingChange={setLoading} />
            )}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}
