"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { NativeSelect } from "@/components/native-select";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveClient,
  DriveFolderResult,
  DriveScope,
  DriveTrashEntry,
  DriveTrashResult,
} from "@/components/plugins/drive/types";
import {
  buttonClass,
  cardClass,
  DriveFeedback,
  DriveModified,
  EntryDialog,
  inputClass,
  messageFor,
  outlineButtonClass,
  primaryClass,
} from "@/components/plugins/drive/ui";
import { errorCode, validName } from "@/components/plugins/drive/utils";
import { TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableFooterClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";

export function TrashBrowser({
  client,
  scope,
  labels,
  locale,
  refreshKey = 0,
}: {
  client: DriveClient;
  scope: DriveScope;
  labels: DriveLabels;
  locale?: string;
  refreshKey?: number;
}) {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [revision, setRevision] = useState(0);
  const request = useMemo(
    () => ({ client, scope, search, cursor, revision, refreshKey }),
    [client, scope, search, cursor, revision, refreshKey],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    data?: DriveTrashResult;
    error?: unknown;
    now?: number;
  }>();
  const [restoring, setRestoring] = useState<string>();
  const [restoreEntry, setRestoreEntry] = useState<DriveTrashEntry>();
  const lock = useRef(false);
  const manager = Toast.useToastManager();
  const loading = result?.request !== request;
  const data = result?.data;
  const error = loading ? undefined : result?.error;
  const disabled = loading || !!error || !!restoring;
  const refresh = () => setRevision((value) => value + 1);
  const restored = () => {
    setRestoreEntry(undefined);
    refresh();
    manager.add({ title: labels.restored, type: "success" });
  };
  useEffect(() => {
    const controller = new AbortController();
    void client.listTrash!({
      scope: request.scope,
      search: request.search,
      cursor: request.cursor,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ request, data, now: Date.now() });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ request, error });
      });
    return () => controller.abort();
  }, [client, request]);
  async function restore(entry: DriveTrashEntry) {
    if (disabled || lock.current) return;
    lock.current = true;
    setRestoring(entry.id);
    try {
      await client.restoreEntry!({ scope, entryId: entry.id });
      restored();
    } catch (reason) {
      if (errorCode(reason) === "RESTORE_CONFLICT") setRestoreEntry(entry);
      else manager.add({ title: messageFor(reason, labels), type: "error" });
    } finally {
      lock.current = false;
      setRestoring(undefined);
    }
  }
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <TableSearch
          value={search}
          label={labels.searchTrash}
          clearLabel={labels.clearSearch}
          onValueChange={(value) => {
            setSearch(value);
            setCursor(undefined);
          }}
        />
        <button className={buttonClass} disabled={loading} onClick={refresh}>
          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
          {labels.retry}
        </button>
      </div>
      <div className={tablePanelClass} aria-busy={loading}>
        <p className="mb-4 text-sm text-muted-foreground">{labels.trashHint}</p>
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[44rem]")} aria-label={labels.trash}>
            <thead>
              <tr className={tableRowClass}>
                {[
                  labels.name,
                  labels.originalLocation,
                  labels.deletedAt,
                  labels.expiresAt,
                  labels.actions,
                ].map((label, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={index === 4 ? tableActionCellClass : tableHeaderClass}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {(!!error || !data?.items.length) && (
                <tr>
                  <td colSpan={5} className={cn(tableCellClass, "py-8")}>
                    <DriveFeedback
                      message={
                        error
                          ? messageFor(error, labels)
                          : loading
                            ? labels.loading
                            : search
                              ? labels.noMatches
                              : labels.emptyTrash
                      }
                      error={!!error}
                    />
                  </td>
                </tr>
              )}
              {data?.items.map((entry) => (
                <tr key={entry.id} className={tableRowClass}>
                  <td className={cn(tableCellClass, "max-w-64 break-all")}>
                    {entry.name}
                    {entry.state === "deleting" && (
                      <output className="mt-1 block text-xs text-muted-foreground">
                        {labels.deleting}
                      </output>
                    )}
                  </td>
                  <td className={cn(tableCellClass, "max-w-64 break-all text-muted-foreground")}>
                    {entry.originalPath || labels.root}
                  </td>
                  <td className={cn(tableCellClass, "whitespace-nowrap text-muted-foreground")}>
                    <DriveModified
                      value={entry.deletedAt}
                      locale={locale}
                      fallback={labels.unavailable}
                    />
                  </td>
                  <td className={cn(tableCellClass, "whitespace-nowrap text-muted-foreground")}>
                    <DriveModified
                      value={entry.expiresAt}
                      locale={locale}
                      fallback={labels.unavailable}
                    />
                  </td>
                  <td className={tableActionCellClass}>
                    <div className="flex justify-end gap-2">
                      {data.space.capabilities.restore && entry.state === "trashed" && (
                        <button
                          className={buttonClass}
                          disabled={disabled || Date.parse(entry.expiresAt) <= (result?.now ?? 0)}
                          onClick={() => void restore(entry)}
                        >
                          <RotateCcwIcon aria-hidden="true" />
                          {restoring === entry.id ? labels.pending : labels.restore}
                        </button>
                      )}
                      {data.space.capabilities.delete && (
                        <EntryDialog
                          client={client}
                          scope={scope}
                          parentId={null}
                          entry={{
                            ...entry,
                            state: entry.state === "deleting" ? "deleting" : "ready",
                          }}
                          deleting
                          disabled={disabled}
                          labels={labels}
                          refresh={() => {
                            refresh();
                            manager.add({ title: labels.deleted, type: "success" });
                          }}
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
        <div className={tableFooterClass}>
          <button
            className={buttonClass}
            aria-label={labels.first}
            disabled={!cursor || loading}
            onClick={() => setCursor(undefined)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </button>
          <button
            className={buttonClass}
            aria-label={labels.next}
            disabled={loading || !!error || !data?.nextCursor}
            onClick={() => setCursor(data?.nextCursor)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </button>
        </div>
      </div>
      {restoreEntry && (
        <RestoreDialog
          client={client}
          scope={scope}
          entry={restoreEntry}
          labels={labels}
          canRename={!!data?.space.capabilities.rename}
          disabled={disabled}
          close={() => setRestoreEntry(undefined)}
          restored={restored}
        />
      )}
    </>
  );
}

function RestoreDialog({
  client,
  scope,
  entry,
  labels,
  canRename,
  disabled,
  close,
  restored,
}: {
  client: DriveClient;
  scope: DriveScope;
  entry: DriveTrashEntry;
  labels: DriveLabels;
  canRename: boolean;
  disabled: boolean;
  close: () => void;
  restored: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [destination, setDestination] = useState<string | null>();
  const [cursor, setCursor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>(labels.RESTORE_CONFLICT);
  const [revision, setRevision] = useState(0);
  const request = useMemo(
    () => ({ client, scope, destination, cursor, revision }),
    [client, scope, destination, cursor, revision],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    data?: DriveFolderResult;
    error?: string;
  }>();
  const folder = result?.data;
  const loading = result?.request !== request;
  const folderError = loading ? undefined : result?.error;
  const lock = useRef(false);
  const fieldId = `factory-drive-restore-${useId()}`;
  useEffect(() => {
    const controller = new AbortController();
    void client
      .listEntries({ scope, parentId: destination ?? null, cursor, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ request, data });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ request, error: messageFor(reason, labels) });
        }
      });
    return () => controller.abort();
  }, [client, scope, destination, cursor, request, labels]);
  async function submit() {
    if (disabled || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await client.restoreEntry!({
        scope,
        entryId: entry.id,
        parentId: destination,
        name: validName(name),
      });
      restored();
    } catch (reason) {
      setError(messageFor(reason, labels));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          onKeyDownCapture={submitDialogOnShortcut}
          className={cn(
            cardClass,
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto shadow-xl",
          )}
        >
          <Dialog.Title className="text-lg font-semibold">{labels.restoreTitle}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.restoreDescription}
          </Dialog.Description>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-2">
              <label htmlFor={fieldId} className="text-sm font-medium">
                {labels.name}
              </label>
              <input
                id={fieldId}
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={255}
                disabled={pending || disabled || !canRename}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-folder`} className="text-sm font-medium">
                {labels.destination}
              </label>
              <NativeSelect
                id={`${fieldId}-folder`}
                className={inputClass}
                value={destination === undefined ? "original" : (destination ?? "root")}
                disabled={pending || disabled || loading}
                onChange={(event) => {
                  setDestination(
                    event.target.value === "original"
                      ? undefined
                      : event.target.value === "root"
                        ? null
                        : event.target.value,
                  );
                  setCursor(undefined);
                }}
              >
                <option value="original">
                  {labels.originalFolder}: {entry.originalPath || labels.root}
                </option>
                <option value="root">{labels.root}</option>
                {folder?.breadcrumbs.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
                {folder?.items
                  .filter((row) => row.kind === "folder" && row.state === "ready")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </NativeSelect>
              <div className="min-h-10">
                <DriveFeedback
                  message={loading ? labels.loading : folderError}
                  error={!!folderError}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  aria-label={labels.first}
                  disabled={!cursor || loading || pending}
                  onClick={() => setCursor(undefined)}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  aria-label={labels.next}
                  disabled={!folder?.nextCursor || loading || pending || !!folderError}
                  onClick={() => setCursor(folder?.nextCursor)}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </button>
                {folderError && (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    <RefreshCwIcon aria-hidden="true" />
                    {labels.retry}
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-15 md:min-h-10">
              <DriveFeedback message={error} error />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close className={outlineButtonClass} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="submit"
                className={primaryClass}
                disabled={pending || disabled || loading || !!folderError}
              >
                {pending ? labels.pending : labels.restore}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
