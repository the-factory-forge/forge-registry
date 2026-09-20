"use client";

import {
  ArrowLeftIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "@/components/link";
import { driveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveBrowserProps,
  DriveEntry,
  DriveFolderResult,
  DrivePageProps,
  DrivePageResult,
  DriveSpace,
  DriveSort,
} from "@/components/plugins/drive/types";
import {
  buttonClass,
  cardClass,
  DriveFeedback,
  DriveModified,
  DriveOwner,
  DriveSize,
  SortHeading,
  EntryDialog,
  inputClass,
  messageFor,
  primaryClass,
} from "@/components/plugins/drive/ui";
import { useUploads } from "@/components/plugins/drive/use-uploads";
import { DriveError, safeDownloadUrl, scopeKey } from "@/components/plugins/drive/utils";
import { cn } from "@/components/utils/cn";

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
  const [cursor, setCursor] = useState<string>();
  const [sort, setSort] = useState<DriveSort>({ field: "name", direction: "asc" });
  const onSort = (next: DriveSort) => {
    setSort(next);
    setCursor(undefined);
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
      <header>
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{labels.description}</p>
      </header>
      <label className="relative block max-w-md">
        <SearchIcon
          className="absolute top-2 left-3 size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label={labels.searchSpaces}
          placeholder={labels.searchSpaces}
          className={cn(inputClass, "pl-10")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCursor(undefined);
          }}
        />
      </label>
      <div className={cardClass} aria-busy={loading}>
        {loading && !!data?.items.length && <DriveFeedback message={labels.loading} />}
        {loading && !data?.items.length ? (
          <DriveFeedback message={labels.loading} />
        ) : error ? (
          <>
            <DriveFeedback message={messageFor(error, labels)} error />
            <button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>
              {labels.retry}
            </button>
          </>
        ) : !data?.items.length ? (
          <p className="text-sm text-muted-foreground">{labels.emptySpaces}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table aria-label={labels.spaces} className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <SortHeading field="name" label={labels.name} sort={sort} onSort={onSort} />
                  <SortHeading
                    field="updatedAt"
                    label={labels.modified}
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeading field="size" label={labels.size} sort={sort} onSort={onSort} />
                  <SortHeading field="owner" label={labels.owner} sort={sort} onSort={onSort} />
                  <th scope="col" className="py-3 text-right font-medium">
                    {labels.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((space) => (
                  <tr key={scopeKey(space.scope)} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3">
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
                        <span className="block text-xs text-muted-foreground">
                          {labels.readOnly}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      <DriveModified
                        value={space.updatedAt}
                        locale={locale}
                        fallback={labels.unavailable}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      <DriveSize value={space.size} locale={locale} fallback={labels.unavailable} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      <DriveOwner owner={space.owner} fallback={labels.unavailable} />
                    </td>
                    <td className="py-3 text-right">
                      {space.href && (
                        <HostLink
                          href={space.href}
                          className={cn(buttonClass, "whitespace-nowrap")}
                        >
                          {labels.openRecord}
                          <span className="sr-only">: {space.name}</span>
                        </HostLink>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {cursor && (
          <button className={buttonClass} disabled={loading} onClick={() => setCursor(undefined)}>
            {labels.first}
          </button>
        )}
        {!error && data?.nextCursor && (
          <button
            className={buttonClass}
            disabled={loading}
            onClick={() => setCursor(data.nextCursor)}
          >
            {labels.next}
          </button>
        )}
      </div>
    </section>
  );
}

export function DriveBrowser(props: DriveBrowserProps) {
  return <Browser key={`${scopeKey(props.scope)}:${props.parentId ?? "root"}`} {...props} />;
}
function Browser({
  client,
  scope,
  parentId = null,
  getFolderHref,
  backHref,
  transferUpload,
  labels: overrides,
  linkComponent: HostLink = Link,
  locale,
  className,
}: DriveBrowserProps) {
  const labels = { ...driveLabels, ...overrides };
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [sort, setSort] = useState<DriveSort>({ field: "name", direction: "asc" });
  const onSort = (next: DriveSort) => {
    setSort(next);
    setCursor(undefined);
  };
  const [revision, setRevision] = useState(0);
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
  const data = result?.data;
  const error = loading ? undefined : result?.error;
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
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
  const capabilities = !loading && !error ? data?.space.capabilities : undefined;
  async function download(entry: DriveEntry) {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    setFeedback(undefined);
    try {
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
      setFeedback({ message: labels.downloading });
    } catch (reason) {
      setFeedback({ message: messageFor(reason, labels), error: true });
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }
  return (
    <section className={cn("space-y-5 text-foreground", className)} aria-label={labels.title}>
      {backHref && (
        <HostLink href={backHref} className={buttonClass}>
          <ArrowLeftIcon aria-hidden="true" />
          {labels.back}
        </HostLink>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{data?.space.name ?? labels.title}</h2>
        {data?.space.href && (
          <HostLink href={data.space.href} className={buttonClass}>
            {labels.openRecord}
          </HostLink>
        )}
      </div>
      <nav aria-label={labels.breadcrumbs}>
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <HostLink
              href={getFolderHref(null)}
              className={buttonClass}
              aria-current={!parentId ? "page" : undefined}
            >
              {labels.root}
            </HostLink>
          </li>
          {data?.breadcrumbs.map((folder) => (
            <li key={folder.id} className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true">/</span>
              <HostLink
                href={getFolderHref(folder.id)}
                className={cn(buttonClass, "break-all")}
                aria-current={folder.id === parentId ? "page" : undefined}
              >
                {folder.name}
              </HostLink>
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          className={cn(inputClass, "max-w-md")}
          aria-label={labels.searchFiles}
          placeholder={labels.searchFiles}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCursor(undefined);
          }}
        />
        {capabilities?.createFolder && (
          <EntryDialog
            client={client}
            scope={scope}
            parentId={parentId}
            labels={labels}
            refresh={() => {
              refresh();
              setFeedback({ message: labels.saved });
            }}
          >
            <FolderPlusIcon aria-hidden="true" />
            {labels.newFolder}
          </EntryDialog>
        )}
        {capabilities?.upload && (
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files && data)
                  queue.add(Array.from(event.target.files), data.maxFileBytes);
                event.target.value = "";
              }}
            />
            <button className={primaryClass} onClick={() => fileInput.current?.click()}>
              <UploadIcon aria-hidden="true" />
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
        className={cn(cardClass, "overflow-hidden")}
        aria-busy={loading}
        onDragOver={(event) => {
          if (capabilities?.upload) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!capabilities?.upload || !data) return;
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
        {capabilities?.upload && (
          <p className="mb-4 text-sm text-muted-foreground">
            {labels.drop} {data && labels.uploadLimit(data.maxFileBytes)}
          </p>
        )}
        {loading && !!data?.items.length && <DriveFeedback message={labels.loading} />}
        {loading && !data?.items.length ? (
          <DriveFeedback message={labels.loading} />
        ) : error ? (
          <>
            <DriveFeedback message={messageFor(error, labels)} error />
            <button className={buttonClass} onClick={refresh}>
              {labels.retry}
            </button>
          </>
        ) : !data?.items.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? labels.noMatches : labels.empty}
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table aria-label={data.space.name} className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <SortHeading field="name" label={labels.name} sort={sort} onSort={onSort} />
                  <SortHeading
                    field="updatedAt"
                    label={labels.modified}
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeading field="size" label={labels.size} sort={sort} onSort={onSort} />
                  <th scope="col" className="px-3 py-3 font-medium">
                    {labels.owner}
                  </th>
                  <th scope="col" className="py-3 text-right font-medium">
                    {labels.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="max-w-[14rem] py-3 pr-3 sm:max-w-none">
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
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      <DriveModified
                        value={entry.updatedAt}
                        locale={locale}
                        fallback={labels.unavailable}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      <DriveSize
                        value={entry.kind === "file" ? entry.size : undefined}
                        locale={locale}
                        fallback={labels.unavailable}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      <DriveOwner owner={data.space.owner} fallback={labels.unavailable} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        {entry.state === "ready" &&
                          capabilities?.download &&
                          entry.kind === "file" && (
                            <button
                              className={buttonClass}
                              aria-label={labels.download}
                              disabled={downloading}
                              onClick={() => void download(entry)}
                            >
                              <DownloadIcon aria-hidden="true" />
                            </button>
                          )}
                        {entry.state === "ready" && capabilities?.rename && (
                          <EntryDialog
                            client={client}
                            scope={scope}
                            parentId={parentId}
                            entry={entry}
                            labels={labels}
                            refresh={() => {
                              refresh();
                              setFeedback({ message: labels.saved });
                            }}
                          >
                            <PencilIcon aria-hidden="true" />
                          </EntryDialog>
                        )}
                        {capabilities?.delete && (
                          <EntryDialog
                            client={client}
                            scope={scope}
                            parentId={parentId}
                            entry={entry}
                            deleting
                            labels={labels}
                            refresh={() => {
                              refresh();
                              setFeedback({ message: labels.saved });
                            }}
                          >
                            <Trash2Icon aria-hidden="true" />
                          </EntryDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {cursor && (
          <button className={buttonClass} disabled={loading} onClick={() => setCursor(undefined)}>
            {labels.first}
          </button>
        )}
        {!error && data?.nextCursor && (
          <button
            className={buttonClass}
            disabled={loading}
            onClick={() => setCursor(data.nextCursor)}
          >
            {labels.next}
          </button>
        )}
      </div>
      {queue.uploads.length > 0 && (
        <div className={cn(cardClass, "space-y-4")}>
          <h3 className="font-semibold">{labels.uploads}</h3>
          <ul className="space-y-4">
            {queue.uploads.map((upload) => (
              <li key={upload.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm break-all">{upload.file.name}</span>
                  <div className="flex items-center gap-1">
                    {["failed", "cancelFailed"].includes(upload.state) && (
                      <button className={buttonClass} onClick={() => queue.retry(upload.id)}>
                        {labels.retry}
                      </button>
                    )}
                    {["queued", "uploading", "failed"].includes(upload.state) && (
                      <button className={buttonClass} onClick={() => queue.cancel(upload.id)}>
                        {labels.cancel}
                      </button>
                    )}
                    {["done", "cancelled"].includes(upload.state) && (
                      <button className={buttonClass} onClick={() => queue.dismiss(upload.id)}>
                        {labels.dismiss}
                      </button>
                    )}
                  </div>
                </div>
                <progress
                  className="h-2 w-full accent-primary"
                  max={100}
                  value={upload.progress}
                  aria-label={labels.progress(upload.file.name)}
                />
                <DriveFeedback
                  message={labels[upload.state]}
                  error={upload.state === "failed" || upload.state === "cancelFailed"}
                />
                {upload.error !== undefined && (
                  <DriveFeedback message={messageFor(upload.error, labels)} error />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
