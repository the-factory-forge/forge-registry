"use client";

import { Toast } from "@base-ui/react/toast";
import {
  RefreshCwIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Link2Icon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { DriveBulkDelete } from "@/components/plugins/drive/bulk-delete";
import { DriveFolderMenu } from "@/components/plugins/drive/folder-menu";
import { DriveFolderTree } from "@/components/plugins/drive/folder-tree";
import { driveLabels } from "@/components/plugins/drive/labels";
import { TrashBrowser } from "@/components/plugins/drive/trash";
import type {
  DriveBrowserProps,
  DriveClient,
  DriveEntry,
  DrivePageProps,
  DriveSpace,
  DriveSort,
} from "@/components/plugins/drive/types";
import {
  buttonClass,
  DriveFeedback,
  DriveFolderIcon,
  DriveModified,
  DriveOwner,
  DriveSize,
  DriveToasts,
  DriveTitle,
  SortHeading,
  EntryDialog,
  iconButtonClass,
  messageFor,
} from "@/components/plugins/drive/ui";
import { useDriveListing } from "@/components/plugins/drive/use-listing";
import { useUploads } from "@/components/plugins/drive/use-uploads";
import {
  DEFAULT_MAX_FILE_BYTES,
  DriveError,
  errorCode,
  safeDownloadUrl,
  scopeKey,
} from "@/components/plugins/drive/utils";
import { sidebarNavActiveClass, sidebarNavItemClass } from "@/components/sidebar-navigation";
import { SubpageSidebar } from "@/components/subpage-sidebar";
import { TablePagination } from "@/components/table-pagination";
import { TableSearch } from "@/components/table-search";
import { TableSelectionCheckbox, useTableSelection } from "@/components/table-selection";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems, useOptimisticAction } from "@/components/utils/use-optimistic-action";

export type * from "@/components/plugins/drive/types";
export type { DriveLabels } from "@/components/plugins/drive/labels";
export type { DriveTransfer } from "@/components/plugins/drive/transfer";
export { transferDriveUpload } from "@/components/plugins/drive/transfer";
export { DriveError, DEFAULT_MAX_FILE_BYTES } from "@/components/plugins/drive/utils";

export function DrivePage({
  client,
  getSpaceHref,
  labels: overrides,
  linkComponent: HostLink = Link,
  className,
  locale,
}: DrivePageProps) {
  const labels = { ...driveLabels, ...overrides };
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const [sort, setSort] = useState<DriveSort>({ field: "name", direction: "asc" });
  const onSort = (next: DriveSort) => {
    setSort(next);
    setCursors([]);
  };
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => client.listSpaces({ search, cursor, sort, signal }),
    [client, search, cursor, sort],
  );
  const { data, loading, error } = useDriveListing(load, revision);
  return (
    <section
      className={cn("space-y-6 p-4 text-foreground md:p-8", className)}
      aria-label={labels.title}
    >
      <div className={cn(tablePanelClass, "space-y-5")} aria-busy={loading}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">{labels.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{labels.description}</p>
          </div>
          <TableSearch
            className="ml-auto"
            value={search}
            label={labels.searchSpaces}
            clearLabel={labels.clearSearch}
            onValueChange={(value) => {
              setSearch(value);
              setCursors([]);
            }}
          />
        </header>
        <div className="relative overflow-x-auto">
          <table aria-label={labels.spaces} className={cn(tableClass, "min-w-[44rem]")}>
            <caption className="sr-only">
              <DriveFeedback message={loading && data?.items.length ? labels.loading : undefined} />
            </caption>
            <thead>
              <tr className={tableRowClass}>
                <SortHeading field="name" label={labels.name} sort={sort} onSort={onSort} />
                <SortHeading
                  field="updatedAt"
                  label={labels.modified}
                  sort={sort}
                  onSort={onSort}
                />
                <SortHeading field="size" label={labels.size} sort={sort} onSort={onSort} />
                <SortHeading field="owner" label={labels.owner} sort={sort} onSort={onSort} />
                <th scope="col" className={tableActionHeaderClass}>
                  {labels.actions}
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {(!!error || !data?.items.length) && (
                <tr>
                  <td colSpan={5} className={cn(tableCellClass, "py-8")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <DriveFeedback
                        message={
                          error
                            ? messageFor(error, labels)
                            : loading
                              ? labels.loading
                              : labels.emptySpaces
                        }
                        error={!!error}
                      />
                      {!!error && (
                        <button
                          className={buttonClass}
                          onClick={() => setRevision((value) => value + 1)}
                        >
                          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                          {labels.retry}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {data?.items.map((space) => (
                <tr key={scopeKey(space.scope)} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <HostLink
                      href={getSpaceHref(space)}
                      className={cn(
                        buttonClass,
                        "group/drive-folder -ml-3 justify-start text-left",
                      )}
                    >
                      <DriveFolderIcon />
                      {space.name}
                    </HostLink>
                    {!Object.entries(space.capabilities).some(
                      ([key, value]) => key !== "download" && value,
                    ) && (
                      <span className="block text-xs text-muted-foreground">{labels.readOnly}</span>
                    )}
                  </td>
                  <td className={cn(tableCellClass, "whitespace-nowrap text-muted-foreground")}>
                    <DriveModified
                      value={space.updatedAt}
                      locale={locale}
                      fallback={labels.unavailable}
                    />
                  </td>
                  <td className={cn(tableCellClass, "whitespace-nowrap text-muted-foreground")}>
                    <DriveSize value={space.size} locale={locale} fallback={labels.unavailable} />
                  </td>
                  <td className={cn(tableCellClass, "text-muted-foreground")}>
                    <DriveOwner owner={space.owner} fallback={labels.unavailable} />
                  </td>
                  <td className={tableActionCellClass}>
                    <div className={tableActionsClass}>
                      <IconTooltip label={`${labels.openFolder}: ${space.name}`}>
                        <HostLink
                          href={getSpaceHref(space)}
                          className={iconButtonClass}
                          aria-label={`${labels.openFolder}: ${space.name}`}
                        >
                          <FolderOpenIcon className="size-4 shrink-0" aria-hidden="true" />
                        </HostLink>
                      </IconTooltip>
                      {space.href && (
                        <IconTooltip label={`${labels.openRecord}: ${space.name}`}>
                          <HostLink
                            href={space.href}
                            className={iconButtonClass}
                            aria-label={`${labels.openRecord}: ${space.name}`}
                          >
                            <Link2Icon className="size-4 shrink-0" aria-hidden="true" />
                          </HostLink>
                        </IconTooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          label={labels.title}
          page={cursors.length + 1}
          previousLabel={labels.previous}
          nextLabel={labels.next}
          previousDisabled={cursors.length === 0}
          nextDisabled={!!error || !data?.nextCursor}
          disabled={loading || !!error}
          onPrevious={() => setCursors(cursors.slice(0, -1))}
          onNext={() => {
            if (data?.nextCursor) setCursors([...cursors, data.nextCursor]);
          }}
        />
      </div>
    </section>
  );
}

export function DriveBrowser(props: DriveBrowserProps) {
  return (
    <ActionToastProvider
      key={`${scopeKey(props.scope)}:${props.parentId ?? "root"}`}
      closeLabel={props.labels?.close}
    >
      <Browser {...props} />
    </ActionToastProvider>
  );
}
function Browser({
  client,
  scope,
  parentId = null,
  getFolderHref,
  backHref,
  onRenameSpace,
  transferUpload,
  onSelectFile,
  isSelectableFile,
  selectFileLabel = "Select file",
  uploadAccept,
  labels: overrides,
  linkComponent: HostLink = Link,
  locale,
  className,
}: DriveBrowserProps) {
  const labels = useMemo(() => ({ ...driveLabels, ...overrides }), [overrides]);
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const [sort, setSort] = useState<DriveSort>({ field: "name", direction: "asc" });
  const onSort = (next: DriveSort) => {
    setSort(next);
    setCursors([]);
  };
  const [revision, setRevision] = useState(0);
  const [trashView, setTrashView] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const trashEnabled = !!(client.listTrash && client.trashEntry && client.restoreEntry);
  const load = useCallback(
    (signal: AbortSignal) => client.listEntries({ scope, parentId, search, cursor, sort, signal }),
    [client, scope, parentId, search, cursor, sort],
  );
  const listing = useDriveListing(load, revision);
  const { loading, error } = listing;
  const mutationScope = useMemo(
    () => ({ client, scope, parentId, search, cursor, sort }),
    [client, scope, parentId, search, cursor, sort],
  );
  const optimistic = useOptimisticAction(listing.data, mutationScope);
  const data = optimistic.value;
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const toastManager = Toast.useToastManager();
  const notify = useActionToast();
  const undoToasts = useRef(new Set<string>());
  const { close: closeToast } = toastManager;
  useEffect(() => {
    const ids = undoToasts.current;
    return () => {
      for (const id of ids) closeToast(id);
    };
  }, [closeToast]);
  const currentClient = useRef(client);
  useEffect(() => {
    currentClient.current = client;
  }, [client]);
  const [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);
  const downloadController = useRef<AbortController | null>(null);
  useEffect(() => () => downloadController.current?.abort(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadDestination = useRef(parentId);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const [folderAction, setFolderAction] = useState<{
    entry: DriveEntry | DriveSpace;
    action: "create" | "rename" | "duplicate" | "trash";
  }>();
  const [removedFolder, setRemovedFolder] = useState<DriveEntry>();
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const queue = useUploads(client, scope, parentId, refresh, transferUpload);
  const capabilities = data?.space.capabilities;
  const selectable = capabilities?.delete
    ? (data?.items ?? []).filter((entry) => !entry.id.startsWith("pending-"))
    : [];
  const selection = useTableSelection(
    selectable,
    JSON.stringify([scope, parentId, search, cursor, sort, trashView]),
  );
  const actionsDisabled =
    loading || !!error || optimistic.pending || selection.pending || !!removedFolder;
  const canDrop = !actionsDisabled && !!capabilities?.upload && !trashView;
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => {
    const clearDrag = () => {
      dragDepth.current = 0;
      setDragActive(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearDrag();
    };
    clearDrag();
    if (!canDrop) return;
    window.addEventListener("drop", clearDrag);
    window.addEventListener("dragend", clearDrag);
    window.addEventListener("blur", clearDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("drop", clearDrag);
      window.removeEventListener("dragend", clearDrag);
      window.removeEventListener("blur", clearDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canDrop]);
  const actionClient: DriveClient = {
    ...client,
    rename: (input) =>
      optimistic.run(
        (current) =>
          current && {
            ...current,
            items: current.items.map((row) =>
              row.id === input.entryId ? { ...row, name: input.name } : row,
            ),
            breadcrumbs: current.breadcrumbs.map((row) =>
              row.id === input.entryId ? { ...row, name: input.name } : row,
            ),
          },
        () => client.rename(input),
      ),
    createFolder: (input) => {
      const entry: DriveEntry = {
        id: `pending-${crypto.randomUUID()}`,
        parentId: input.parentId,
        kind: "folder",
        name: input.name,
        size: 0,
        contentType: "",
        updatedAt: new Date().toISOString(),
        state: "ready",
      };
      return optimistic.run(
        (current) =>
          current && input.parentId === parentId
            ? { ...current, items: [...current.items, entry] }
            : current,
        () => client.createFolder(input),
      );
    },
    deleteEntry: (input) =>
      optimistic.run(
        (current) =>
          current && { ...current, items: current.items.filter((row) => row.id !== input.entryId) },
        () => client.deleteEntry(input),
      ),
    trashEntry:
      client.trashEntry &&
      ((input) =>
        optimistic.run(
          (current) =>
            current && {
              ...current,
              items: current.items.filter((row) => row.id !== input.entryId),
            },
          () => client.trashEntry!(input),
        )),
  };
  const renameSpace =
    onRenameSpace &&
    ((name: string) =>
      optimistic.run(
        (current) => current && { ...current, space: { ...current.space, name } },
        () => onRenameSpace(name),
      ));
  function deleted(entry: DriveEntry) {
    if (data?.breadcrumbs.some((crumb) => crumb.id === entry.id)) setRemovedFolder(entry);
    refresh();
    setFeedback(undefined);
    const trashed = trashEnabled && entry.state === "ready";
    let pending = false;
    const actionProps = { children: labels.undo, onClick: () => void undo() };
    const id = toastManager.add({
      title: trashed ? labels.trashed : labels.deleted,
      data: { closeLabel: labels.close },
      type: "success",
      actionProps: trashed && capabilities?.restore ? actionProps : undefined,
      onRemove: () => {
        undoToasts.current.delete(id);
      },
    });
    if (trashed && capabilities?.restore) undoToasts.current.add(id);
    async function undo() {
      if (pending) return;
      pending = true;
      toastManager.update(id, {
        title: labels.restoring,
        type: "loading",
        timeout: 0,
        description: undefined,
        actionProps: { ...actionProps, disabled: true, "aria-busy": true },
      });
      try {
        await optimistic.run(
          (current) =>
            current && {
              ...current,
              items:
                entry.parentId !== parentId || current.items.some((row) => row.id === entry.id)
                  ? current.items
                  : [...current.items, entry],
            },
          () => currentClient.current.restoreEntry!({ scope, entryId: entry.id }),
        );
        setRemovedFolder(undefined);
        refresh();
        toastManager.update(id, {
          title: labels.restored,
          type: "success",
          description: undefined,
          actionProps: undefined,
          timeout: 5000,
        });
      } catch (reason) {
        const conflict = errorCode(reason) === "RESTORE_CONFLICT";
        toastManager.update(id, {
          title: labels.trashed,
          type: "error",
          description: conflict ? labels.undoConflict : messageFor(reason, labels),
          actionProps: conflict
            ? {
                children: labels.trash,
                onClick: () => {
                  toastManager.close(id);
                  setTrashView(true);
                },
              }
            : actionProps,
        });
      } finally {
        pending = false;
      }
    }
  }
  async function download(entry: DriveEntry | DriveSpace) {
    if (actionsDisabled || downloadLock.current) return;
    downloadLock.current = true;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(true);
    setFeedback(undefined);
    try {
      await toastManager
        .promise(
          (async () => {
            const file = "kind" in entry && entry.kind === "file" ? entry : undefined;
            let result: { url: string };
            if (file) {
              result = await client.getDownload({ scope, entryId: file.id });
              controller.signal.throwIfAborted();
            } else {
              const archive = await import("@/components/plugins/drive/download").then(
                ({ downloadFolder }) => downloadFolder(client, scope, entry, controller.signal),
              );
              controller.signal.throwIfAborted();
              result = { url: URL.createObjectURL(archive) };
            }
            const url = safeDownloadUrl(result.url);
            if (!url) throw new DriveError("INVALID");
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = file ? entry.name : `${entry.name}.zip`;
            anchor.rel = "noopener";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            if (!file) setTimeout(() => URL.revokeObjectURL(url), 60_000);
          })(),
          {
            loading: { title: labels.loading, data: { closeLabel: labels.close } },
            success: { title: labels.downloading },
            error: (reason) => ({ title: messageFor(reason, labels), timeout: 0 }),
          },
        )
        .catch(() => undefined);
    } finally {
      downloadLock.current = false;
      downloadController.current = null;
      setDownloading(false);
    }
  }
  function renderFolderMenu(entry: DriveEntry | DriveSpace, disabled = false) {
    return (
      <DriveFolderMenu
        entry={entry}
        client={client}
        capabilities={
          "kind" in entry ? capabilities : { ...entry.capabilities, rename: !!onRenameSpace }
        }
        trashEnabled={trashEnabled}
        labels={labels}
        disabled={disabled || actionsDisabled}
        downloading={downloading}
        onDownload={(entry) => void download(entry)}
        onUpload={(folder, directory) => {
          uploadDestination.current = "kind" in folder ? folder.id : null;
          if (fileInput.current) {
            fileInput.current.webkitdirectory = directory;
            fileInput.current.click();
          }
        }}
        onAction={(entry, action, trigger) => {
          menuTrigger.current = trigger;
          setFolderAction({ entry, action });
        }}
      />
    );
  }
  return (
    <section className={cn("space-y-5 text-foreground", className)} aria-label={labels.title}>
      {capabilities?.upload && (
        <input
          ref={fileInput}
          type="file"
          accept={uploadAccept}
          multiple
          hidden
          disabled={actionsDisabled}
          onChange={(event) => {
            const directory = event.currentTarget.webkitdirectory;
            if (
              !actionsDisabled &&
              event.target.files &&
              data &&
              (!directory || (capabilities.createFolder && client.prepareFolderUpload))
            )
              queue.add(
                Array.from(event.target.files),
                data.maxFileBytes,
                uploadDestination.current,
                directory,
              );
            event.target.value = "";
            event.currentTarget.webkitdirectory = false;
          }}
        />
      )}
      {folderAction && (
        <EntryDialog
          client={actionClient}
          scope={scope}
          parentId={
            "kind" in folderAction.entry
              ? folderAction.action === "create"
                ? folderAction.entry.id
                : folderAction.entry.parentId
              : null
          }
          entry={
            folderAction.action !== "create" && "kind" in folderAction.entry
              ? folderAction.entry
              : undefined
          }
          space={
            folderAction.action === "rename" && !("kind" in folderAction.entry)
              ? folderAction.entry
              : undefined
          }
          onRenameSpace={renameSpace}
          labels={labels}
          deleting={folderAction.action === "trash"}
          trashing={folderAction.action === "trash"}
          duplicating={folderAction.action === "duplicate"}
          onClose={() => setFolderAction(undefined)}
          returnFocus={menuTrigger}
          refresh={() => {
            if (folderAction.action === "trash" && "kind" in folderAction.entry)
              deleted(folderAction.entry);
            else {
              refresh();
              setFeedback(undefined);
              notify(folderAction.action === "duplicate" ? labels.duplicated : labels.saved);
            }
          }}
        />
      )}
      {(backHref || parentId || onRenameSpace) && (
        <div className="flex min-h-10 items-start justify-between gap-3 md:min-h-8">
          <nav aria-label={labels.breadcrumbs} className="min-w-0">
            <ol className="flex flex-wrap items-center gap-2 text-base">
              {backHref && (
                <li className="flex min-w-0 items-center gap-2">
                  <HostLink
                    href={backHref}
                    className={cn(buttonClass, "text-base text-muted-foreground")}
                  >
                    {labels.title}
                  </HostLink>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </li>
              )}
              {[
                { id: null, name: data?.space.name ?? labels.title },
                ...(data?.breadcrumbs ?? []),
              ].map((crumb) => (
                <li key={crumb.id ?? "root"} className="flex max-w-full min-w-0 items-center gap-2">
                  {crumb.id === parentId ? (
                    <DriveTitle
                      name={crumb.name}
                      disabled={actionsDisabled}
                      labels={labels}
                      onRename={
                        data && (crumb.id ? capabilities?.rename : renameSpace)
                          ? async (name) => {
                              if (crumb.id)
                                await actionClient.rename({ scope, entryId: crumb.id, name });
                              else await renameSpace!(name);
                              refresh();
                              setFeedback(undefined);
                              notify(labels.saved);
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <>
                      <HostLink
                        href={getFolderHref(crumb.id)}
                        className={cn(
                          buttonClass,
                          "min-w-0 text-left text-base wrap-anywhere text-muted-foreground",
                        )}
                      >
                        {crumb.name}
                      </HostLink>
                      <ChevronRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          {data?.space.href && (
            <IconTooltip label={`${labels.openRecord}: ${data.space.name}`}>
              <HostLink
                href={data.space.href}
                className={iconButtonClass}
                aria-label={`${labels.openRecord}: ${data.space.name}`}
              >
                <Link2Icon className="size-4 shrink-0" aria-hidden="true" />
              </HostLink>
            </IconTooltip>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-5 md:flex-row">
        <SubpageSidebar
          label={labels.navigation}
          closeLabel={labels.closeNavigation}
          pathname={trashView ? "" : getFolderHref(parentId)}
          linkComponent={HostLink}
          groups={[
            {
              id: "files",
              items: [],
              footer: (closeNavigation) => (
                <>
                  <div className="flex items-center gap-1">
                    <HostLink
                      href={getFolderHref(null)}
                      aria-current={!trashView && parentId === null ? "page" : undefined}
                      className={cn(
                        sidebarNavItemClass,
                        "min-w-0 flex-1",
                        !trashView && parentId === null && sidebarNavActiveClass,
                      )}
                      onClick={(event) => {
                        if (
                          !event.defaultPrevented &&
                          event.button === 0 &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey
                        ) {
                          setTrashView(false);
                          refresh();
                          closeNavigation();
                        }
                      }}
                    >
                      <DriveFolderIcon
                        open={!trashView && parentId === null}
                        loading={foldersLoading}
                      />
                      <span className="min-w-0 flex-1 text-left wrap-anywhere">
                        {data?.space.name ?? labels.title}
                      </span>
                    </HostLink>
                    {data && renderFolderMenu(data.space)}
                  </div>
                  <DriveFolderTree
                    client={client}
                    scope={scope}
                    parentId={null}
                    currentFolderId={parentId}
                    breadcrumbs={data?.breadcrumbs ?? []}
                    labels={labels}
                    getFolderHref={getFolderHref}
                    linkComponent={HostLink}
                    refreshKey={revision}
                    onLoadingChange={setFoldersLoading}
                    filesActive={!trashView}
                    renderActions={renderFolderMenu}
                    onNavigate={() => {
                      setTrashView(false);
                      closeNavigation();
                    }}
                  />
                </>
              ),
            },
            ...(trashEnabled
              ? [
                  {
                    id: "trash",
                    items: [
                      {
                        id: "trash",
                        label: labels.trash,
                        icon: <Trash2Icon />,
                        active: trashView,
                        onSelect: () => setTrashView(true),
                      },
                    ],
                  },
                ]
              : []),
          ]}
        />
        <div className="min-w-0 flex-1 space-y-5">
          {trashView && trashEnabled ? (
            <>
              <h2 className="text-base font-semibold">{labels.trash}</h2>
              <TrashBrowser
                client={client}
                scope={scope}
                labels={labels}
                locale={locale}
                refreshKey={revision}
                onChanged={refresh}
              />
            </>
          ) : removedFolder ? (
            <div className={tablePanelClass}>
              <p className="mb-3 text-sm">{labels.trashed}</p>
              <HostLink href={getFolderHref(removedFolder.parentId)} className={buttonClass}>
                {labels.openFolder}
              </HostLink>
            </div>
          ) : (
            <>
              {capabilities &&
                !capabilities.upload &&
                !capabilities.createFolder &&
                !capabilities.rename &&
                !capabilities.delete && (
                  <p className="text-right text-sm text-muted-foreground">{labels.readOnly}</p>
                )}
              <DriveFeedback {...feedback} />
              <div
                className={cn(tablePanelClass, "relative overflow-hidden")}
                aria-busy={loading}
                onDragEnter={(event) => {
                  if (!canDrop || !event.dataTransfer.types.includes("Files")) return;
                  event.preventDefault();
                  dragDepth.current += 1;
                  setDragActive(true);
                }}
                onDragLeave={() => {
                  dragDepth.current = Math.max(0, dragDepth.current - 1);
                  if (dragDepth.current === 0) setDragActive(false);
                }}
                onDragOver={(event) => {
                  if (canDrop && event.dataTransfer.types.includes("Files")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dragDepth.current = 0;
                  setDragActive(false);
                  if (!canDrop || !data) return;
                  if (
                    Array.from(event.dataTransfer.items).some(
                      (item) => item.webkitGetAsEntry?.()?.isDirectory,
                    )
                  ) {
                    setFeedback({ message: labels.folderDrop, error: true });
                    return;
                  }
                  queue.add(Array.from(event.dataTransfer.files), data.maxFileBytes);
                }}
              >
                {canDrop && dragActive && (
                  <output
                    aria-atomic="true"
                    className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/95 p-6 text-center text-foreground"
                  >
                    <UploadIcon className="size-10 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-lg font-semibold">{labels.dropActive}</span>
                    <span className="text-sm text-muted-foreground">
                      {labels.uploadLimit(data?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)}
                    </span>
                  </output>
                )}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      !capabilities?.upload && "invisible",
                    )}
                    aria-hidden={!capabilities?.upload}
                  >
                    {labels.drop} {labels.uploadLimit(data?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)}
                  </p>
                  <TableSearch
                    className="ml-auto"
                    value={search}
                    label={labels.searchFiles}
                    clearLabel={labels.clearSearch}
                    onValueChange={(value) => {
                      setSearch(value);
                      setCursors([]);
                    }}
                  />
                </div>
                <div className="relative overflow-x-auto">
                  <table
                    aria-label={data?.space.name ?? labels.title}
                    className={cn(tableClass, "min-w-[44rem]")}
                  >
                    <caption className="sr-only">
                      <DriveFeedback
                        message={loading && data?.items.length ? labels.loading : undefined}
                      />
                    </caption>
                    <thead>
                      <tr className={tableRowClass}>
                        {capabilities?.delete && (
                          <th scope="col" className="w-10 p-2">
                            <TableSelectionCheckbox
                              label={labels.selectAllRows}
                              checked={selection.all}
                              mixed={selection.mixed}
                              onChange={selection.toggleAll}
                              disabled={actionsDisabled || !selectable.length}
                            />
                          </th>
                        )}
                        <SortHeading field="name" label={labels.name} sort={sort} onSort={onSort} />
                        <SortHeading
                          field="updatedAt"
                          label={labels.modified}
                          sort={sort}
                          onSort={onSort}
                        />
                        <SortHeading field="size" label={labels.size} sort={sort} onSort={onSort} />
                        <th scope="col" className={tableHeaderClass}>
                          {labels.owner}
                        </th>
                        <th scope="col" className={tableActionHeaderClass}>
                          <div className="flex items-center justify-end gap-2">
                            {labels.actions}
                            {capabilities?.delete && (
                              <DriveBulkDelete
                                client={client}
                                scope={scope}
                                selection={selection}
                                labels={labels}
                                disabled={actionsDisabled}
                                trashEnabled={trashEnabled}
                                onDeleted={deleted}
                              />
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {(!!error || !data?.items.length) && (
                        <tr>
                          <td
                            colSpan={5 + (capabilities?.delete ? 1 : 0)}
                            className={cn(tableCellClass, "py-8")}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <DriveFeedback
                                message={
                                  error
                                    ? messageFor(error, labels)
                                    : loading
                                      ? labels.loading
                                      : search
                                        ? labels.noMatches
                                        : labels.empty
                                }
                                error={!!error}
                              />
                              {!!error && (
                                <button className={buttonClass} onClick={refresh}>
                                  <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                                  {labels.retry}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {data &&
                        retainRemovedItems(
                          data.items,
                          listing.data?.items ?? [],
                          optimistic.pending,
                        ).map((entry) => (
                          <tr
                            key={entry.id}
                            hidden={
                              selection.isDeleting(entry.id) ||
                              !data.items.some((row) => row.id === entry.id)
                            }
                            className={tableRowClass}
                          >
                            {capabilities?.delete && (
                              <td className="w-10 p-2">
                                <TableSelectionCheckbox
                                  label={`${labels.selectRow}: ${entry.name}`}
                                  checked={selection.selected.some((row) => row.id === entry.id)}
                                  onChange={(checked) => selection.toggle(entry.id, checked)}
                                  disabled={actionsDisabled || entry.id.startsWith("pending-")}
                                />
                              </td>
                            )}
                            <td className={cn(tableCellClass, "max-w-[14rem] sm:max-w-none")}>
                              <div className="flex items-center gap-2">
                                {entry.kind === "folder" && entry.state === "ready" ? (
                                  <HostLink
                                    href={getFolderHref(entry.id)}
                                    aria-disabled={entry.id.startsWith("pending-")}
                                    onClick={(event) => {
                                      if (entry.id.startsWith("pending-")) event.preventDefault();
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-2 rounded break-all hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:cursor-not-allowed",
                                      !entry.id.startsWith("pending-") && "group/drive-folder",
                                    )}
                                  >
                                    <DriveFolderIcon className="size-5 text-muted-foreground" />
                                    <span>{entry.name}</span>
                                  </HostLink>
                                ) : (
                                  <>
                                    {entry.kind === "folder" ? (
                                      <FolderIcon
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <FileIcon
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="break-all">{entry.name}</span>
                                  </>
                                )}
                              </div>
                              {entry.state === "deleting" && (
                                <output className="mt-1 block text-xs text-muted-foreground">
                                  {labels.deleting}
                                </output>
                              )}
                            </td>
                            <td
                              className={cn(
                                tableCellClass,
                                "whitespace-nowrap text-muted-foreground",
                              )}
                            >
                              <DriveModified
                                value={entry.updatedAt}
                                locale={locale}
                                fallback={labels.unavailable}
                              />
                            </td>
                            <td
                              className={cn(
                                tableCellClass,
                                "whitespace-nowrap text-muted-foreground",
                              )}
                            >
                              <DriveSize
                                value={entry.kind === "file" ? entry.size : undefined}
                                locale={locale}
                                fallback={labels.unavailable}
                              />
                            </td>
                            <td className={cn(tableCellClass, "text-muted-foreground")}>
                              <DriveOwner owner={data.space.owner} fallback={labels.unavailable} />
                            </td>
                            <td className={tableActionCellClass}>
                              <div className={tableActionsClass}>
                                {onSelectFile &&
                                  entry.kind === "file" &&
                                  entry.state === "ready" &&
                                  (!isSelectableFile || isSelectableFile(entry)) && (
                                    <button
                                      type="button"
                                      className={buttonClass}
                                      disabled={actionsDisabled}
                                      onClick={() => onSelectFile(entry)}
                                    >
                                      {selectFileLabel}
                                    </button>
                                  )}
                                {entry.state === "ready" &&
                                  capabilities?.download &&
                                  entry.kind === "file" && (
                                    <IconTooltip label={labels.download}>
                                      <button
                                        className={iconButtonClass}
                                        aria-label={labels.download}
                                        disabled={actionsDisabled || downloading}
                                        onClick={() => void download(entry)}
                                      >
                                        <DownloadIcon aria-hidden="true" />
                                      </button>
                                    </IconTooltip>
                                  )}
                                {entry.state === "ready" && capabilities?.rename && (
                                  <EntryDialog
                                    client={actionClient}
                                    scope={scope}
                                    parentId={parentId}
                                    entry={entry}
                                    disabled={actionsDisabled}
                                    labels={labels}
                                    refresh={() => {
                                      refresh();
                                      setFeedback(undefined);
                                      notify(labels.saved);
                                    }}
                                  >
                                    <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                                  </EntryDialog>
                                )}
                                {capabilities?.delete && (
                                  <EntryDialog
                                    client={actionClient}
                                    scope={scope}
                                    parentId={parentId}
                                    entry={entry}
                                    deleting
                                    trashing={trashEnabled && entry.state === "ready"}
                                    disabled={actionsDisabled}
                                    labels={labels}
                                    refresh={() => deleted(entry)}
                                  >
                                    <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
                                  </EntryDialog>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  label={labels.title}
                  page={cursors.length + 1}
                  previousLabel={labels.previous}
                  nextLabel={labels.next}
                  previousDisabled={cursors.length === 0}
                  nextDisabled={!!error || !data?.nextCursor}
                  disabled={actionsDisabled}
                  onPrevious={() => setCursors(cursors.slice(0, -1))}
                  onNext={() => {
                    if (data?.nextCursor) setCursors([...cursors, data.nextCursor]);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <DriveToasts labels={labels} queue={queue} />
    </section>
  );
}
