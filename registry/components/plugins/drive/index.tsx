"use client";

import { Toast } from "@base-ui/react/toast";
import {
  RefreshCwIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { DriveFolderTree } from "@/components/plugins/drive/folder-tree";
import { driveLabels } from "@/components/plugins/drive/labels";
import { TrashBrowser } from "@/components/plugins/drive/trash";
import type {
  DriveBrowserProps,
  DriveClient,
  DriveEntry,
  DriveFolderResult,
  DrivePageProps,
  DrivePageResult,
  DriveSpace,
  DriveSort,
} from "@/components/plugins/drive/types";
import {
  buttonClass,
  DriveFeedback,
  DriveModified,
  DriveOwner,
  DriveSize,
  DriveToasts,
  SortHeading,
  EntryDialog,
  iconButtonClass,
  messageFor,
  primaryClass,
} from "@/components/plugins/drive/ui";
import { useUploads } from "@/components/plugins/drive/use-uploads";
import {
  DEFAULT_MAX_FILE_BYTES,
  DriveError,
  errorCode,
  safeDownloadUrl,
  scopeKey,
} from "@/components/plugins/drive/utils";
import { SubpageSidebar } from "@/components/subpage-sidebar";
import { TablePagination } from "@/components/table-pagination";
import { TableSearch } from "@/components/table-search";
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
  const request = useMemo(
    () => ({ client, search, cursor, sort, revision }),
    [client, search, cursor, sort, revision],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    data?: DrivePageResult<DriveSpace>;
    error?: unknown;
  }>();
  const loading = result?.request !== request;
  const data = result?.data;
  const error = loading ? undefined : result?.error;
  useEffect(() => {
    const controller = new AbortController();
    void request.client
      .listSpaces({
        search: request.search,
        cursor: request.cursor,
        sort: request.sort,
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ request, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ request, error });
      });
    return () => controller.abort();
  }, [request]);
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
                      className={cn(buttonClass, "-ml-3 justify-start text-left")}
                    >
                      <FolderIcon className="shrink-0" aria-hidden="true" />
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
                    {space.href && (
                      <IconTooltip label={`${labels.openRecord}: ${space.name}`}>
                        <HostLink
                          href={space.href}
                          className={iconButtonClass}
                          aria-label={`${labels.openRecord}: ${space.name}`}
                        >
                          <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
                        </HostLink>
                      </IconTooltip>
                    )}
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
          disabled={loading}
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
    <Toast.Provider key={`${scopeKey(props.scope)}:${props.parentId ?? "root"}`} limit={Infinity}>
      <Browser {...props} />
    </Toast.Provider>
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
  const trashEnabled = !!(client.listTrash && client.trashEntry && client.restoreEntry);
  const request = useMemo(
    () => ({ client, scope, parentId, search, cursor, sort, revision }),
    [client, scope, parentId, search, cursor, sort, revision],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    data?: DriveFolderResult;
    error?: unknown;
  }>();
  const loading = result?.request !== request;
  const mutationScope = useMemo(
    () => ({ client, scope, parentId, search, cursor, sort }),
    [client, scope, parentId, search, cursor, sort],
  );
  const optimistic = useOptimisticAction(result?.data, mutationScope);
  const data = optimistic.value;
  const error = loading ? undefined : result?.error;
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const toastManager = Toast.useToastManager();
  const currentClient = useRef(client);
  useEffect(() => {
    currentClient.current = client;
  }, [client]);
  const [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const queue = useUploads(client, scope, parentId, refresh, transferUpload);
  useEffect(() => {
    const controller = new AbortController();
    void request.client
      .listEntries({
        scope: request.scope,
        parentId: request.parentId,
        search: request.search,
        cursor: request.cursor,
        sort: request.sort,
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ request, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ request, error });
      });
    return () => controller.abort();
  }, [request]);
  const capabilities = data?.space.capabilities;
  const actionsDisabled = loading || !!error || optimistic.pending;
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
        parentId,
        kind: "folder",
        name: input.name,
        size: 0,
        contentType: "",
        updatedAt: new Date().toISOString(),
        state: "ready",
      };
      return optimistic.run(
        (current) => current && { ...current, items: [...current.items, entry] },
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
    refresh();
    setFeedback(undefined);
    const trashed = trashEnabled && entry.state === "ready";
    let pending = false;
    const actionProps = { children: labels.undo, onClick: () => void undo() };
    const id = toastManager.add({
      title: trashed ? labels.trashed : labels.deleted,
      type: "success",
      actionProps: trashed && capabilities?.restore ? actionProps : undefined,
    });
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
              items: current.items.some((row) => row.id === entry.id)
                ? current.items
                : [...current.items, entry],
            },
          () => currentClient.current.restoreEntry!({ scope, entryId: entry.id }),
        );
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
  async function download(entry: DriveEntry) {
    if (actionsDisabled || downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    setFeedback(undefined);
    try {
      await toastManager
        .promise(
          (async () => {
            const result = await client.getDownload({ scope, entryId: entry.id });
            const url = safeDownloadUrl(result.url);
            if (!url) throw new DriveError("INVALID");
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = entry.name;
            anchor.rel = "noopener";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
          })(),
          {
            loading: { title: labels.loading },
            success: { title: labels.downloading },
            error: (reason) => ({ title: messageFor(reason, labels), timeout: 0 }),
          },
        )
        .catch(() => undefined);
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }
  return (
    <section className={cn("space-y-5 text-foreground", className)} aria-label={labels.title}>
      <DriveFeedback
        message={optimistic.error ? messageFor(optimistic.error, labels) : undefined}
        error
      />
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
                  <>
                    <h2 className="min-w-0 py-1.5 font-medium wrap-anywhere" aria-current="page">
                      {crumb.name}
                    </h2>
                    {data && (parentId ? capabilities?.rename : onRenameSpace) && (
                      <EntryDialog
                        client={actionClient}
                        scope={scope}
                        parentId={parentId}
                        entry={crumb.id ? { id: crumb.id, name: crumb.name } : undefined}
                        space={crumb.id ? undefined : data.space}
                        onRenameSpace={renameSpace}
                        menu
                        disabled={actionsDisabled}
                        labels={labels}
                        refresh={() => {
                          refresh();
                          setFeedback(undefined);
                          toastManager.add({ title: labels.saved, type: "success" });
                        }}
                      />
                    )}
                  </>
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
              <ExternalLinkIcon className="size-4 shrink-0" aria-hidden="true" />
            </HostLink>
          </IconTooltip>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-5 md:flex-row">
        <SubpageSidebar
          label={labels.navigation}
          closeLabel={labels.closeNavigation}
          pathname={trashView ? "" : getFolderHref(parentId)}
          linkComponent={HostLink}
          groups={[
            {
              id: "files",
              items: [
                {
                  id: "all-files",
                  label: labels.root,
                  icon: <FolderIcon />,
                  href: getFolderHref(null),
                  exact: true,
                  onNavigate: () => {
                    setTrashView(false);
                    refresh();
                  },
                },
              ],
              footer: (closeNavigation) => (
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
                  filesActive={!trashView}
                  onNavigate={() => {
                    setTrashView(false);
                    closeNavigation();
                  }}
                />
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
          ) : (
            <>
              <div className="flex min-h-22 flex-wrap content-end items-center justify-end gap-2 md:min-h-8">
                {capabilities?.createFolder && (
                  <EntryDialog
                    client={actionClient}
                    scope={scope}
                    parentId={parentId}
                    disabled={actionsDisabled}
                    labels={labels}
                    refresh={() => {
                      refresh();
                      setFeedback(undefined);
                      toastManager.add({ title: labels.saved, type: "success" });
                    }}
                  >
                    <FolderPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                    {labels.newFolder}
                  </EntryDialog>
                )}
                {capabilities?.upload && (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept={uploadAccept}
                      multiple
                      hidden
                      disabled={actionsDisabled}
                      onChange={(event) => {
                        if (!actionsDisabled && event.target.files && data)
                          queue.add(Array.from(event.target.files), data.maxFileBytes);
                        event.target.value = "";
                      }}
                    />
                    <button
                      className={primaryClass}
                      disabled={actionsDisabled}
                      onClick={() => fileInput.current?.click()}
                    >
                      <UploadIcon className="size-4 shrink-0" aria-hidden="true" />
                      {labels.upload}
                    </button>
                  </>
                )}
                {capabilities &&
                  !capabilities.upload &&
                  !capabilities.createFolder &&
                  !capabilities.rename &&
                  !capabilities.delete && (
                    <span className="text-sm text-muted-foreground">{labels.readOnly}</span>
                  )}
              </div>
              <DriveFeedback {...feedback} />
              <div
                className={cn(tablePanelClass, "overflow-hidden")}
                aria-busy={loading}
                onDragOver={(event) => {
                  if (!actionsDisabled && capabilities?.upload) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (actionsDisabled || !capabilities?.upload || !data) return;
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
                          result?.data?.items ?? [],
                          optimistic.pending,
                        ).map((entry) => (
                          <tr
                            key={entry.id}
                            hidden={!data.items.some((row) => row.id === entry.id)}
                            className={tableRowClass}
                          >
                            <td className={cn(tableCellClass, "max-w-[14rem] sm:max-w-none")}>
                              <div className="flex items-center gap-2">
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
                                {entry.kind === "folder" && entry.state === "ready" ? (
                                  <HostLink
                                    href={getFolderHref(entry.id)}
                                    aria-disabled={entry.id.startsWith("pending-")}
                                    onClick={(event) => {
                                      if (entry.id.startsWith("pending-")) event.preventDefault();
                                    }}
                                    className="rounded break-all hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                  >
                                    {entry.name}
                                  </HostLink>
                                ) : (
                                  <span className="break-all">{entry.name}</span>
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
                                      toastManager.add({ title: labels.saved, type: "success" });
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
                  disabled={loading}
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
