"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { XIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { NativeSelect } from "@/components/native-select";
import { DriveBulkDelete } from "@/components/plugins/drive/bulk-delete";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type { DriveClient, DriveScope, DriveTrashEntry } from "@/components/plugins/drive/types";
import {
  buttonClass,
  iconButtonClass,
  cardClass,
  DriveFeedback,
  DriveModified,
  EntryDialog,
  inputClass,
  messageFor,
  outlineButtonClass,
  primaryClass,
} from "@/components/plugins/drive/ui";
import { useDriveListing } from "@/components/plugins/drive/use-listing";
import { errorCode, validName } from "@/components/plugins/drive/utils";
import { TablePagination } from "@/components/table-pagination";
import { TableSearch } from "@/components/table-search";
import { TableSelectionCheckbox, useTableSelection } from "@/components/table-selection";
import { cn } from "@/components/utils/cn";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";
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

export function TrashBrowser({
  client,
  scope,
  labels,
  locale,
  refreshKey = 0,
  onChanged,
}: {
  client: DriveClient;
  scope: DriveScope;
  labels: DriveLabels;
  locale?: string;
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => client.listTrash!({ scope, search, cursor, signal }),
    [client, scope, search, cursor],
  );
  const listing = useDriveListing(load, `${revision}:${refreshKey}`);
  const { loading, error } = listing;
  const [restoring, setRestoring] = useState<string>();
  const [restoreEntry, setRestoreEntry] = useState<DriveTrashEntry>();
  const lock = useRef(false);
  const manager = Toast.useToastManager();
  const notify = useActionToast();
  const mutationScope = useMemo(
    () => ({ client, scope, search, cursor }),
    [client, scope, search, cursor],
  );
  const optimistic = useOptimisticAction(listing.data, mutationScope);
  const data = optimistic.value;
  const capabilities = data?.space.capabilities;
  const selectable = capabilities?.delete ? (data?.items ?? []) : [];
  const selection = useTableSelection(selectable, JSON.stringify([scope, search, cursor]));
  const disabled = loading || !!error || !!restoring || optimistic.pending || selection.pending;
  const refresh = () => setRevision((value) => value + 1);
  const restored = () => {
    setRestoreEntry(undefined);
    refresh();
    onChanged?.();
    notify(labels.restored);
  };
  async function restore(entry: DriveTrashEntry) {
    if (disabled || lock.current) return;
    lock.current = true;
    setRestoring(entry.id);
    try {
      await optimistic.run(
        (current) =>
          current && { ...current, items: current.items.filter((row) => row.id !== entry.id) },
        () => client.restoreEntry!({ scope, entryId: entry.id }),
      );
      restored();
    } catch (reason) {
      if (errorCode(reason) === "RESTORE_CONFLICT") setRestoreEntry(entry);
      else
        manager.add({
          title: messageFor(reason, labels),
          type: "error",
          data: { closeLabel: labels.close },
        });
    } finally {
      lock.current = false;
      setRestoring(undefined);
    }
  }
  return (
    <>
      <DriveFeedback
        message={optimistic.error ? messageFor(optimistic.error, labels) : undefined}
        error
      />
      <div className={tablePanelClass} aria-busy={loading}>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-80 space-y-1.5">
            <h2 className="text-base font-semibold wrap-anywhere">{labels.trash}</h2>
            <p className="text-sm text-muted-foreground">{labels.trashHint}</p>
          </div>
          <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2">
            <TableSearch
              value={search}
              label={labels.searchTrash}
              clearLabel={labels.clearSearch}
              onValueChange={(value) => {
                setSearch(value);
                setCursors([]);
              }}
            />
            <button
              className={buttonClass}
              disabled={loading || !!restoring || optimistic.pending || selection.pending}
              onClick={refresh}
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.retry}
            </button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[44rem]")} aria-label={labels.trash}>
            <thead>
              <tr className={tableRowClass}>
                {capabilities?.delete && (
                  <th scope="col" className="w-10 p-2">
                    <TableSelectionCheckbox
                      label={labels.selectAllRows}
                      checked={selection.all}
                      mixed={selection.mixed}
                      onChange={selection.toggleAll}
                      disabled={disabled || !selectable.length}
                    />
                  </th>
                )}
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
                    className={index === 4 ? tableActionHeaderClass : tableHeaderClass}
                  >
                    <div
                      className={index === 4 ? "flex items-center justify-end gap-2" : undefined}
                    >
                      {label}
                      {index === 4 && capabilities?.delete && (
                        <DriveBulkDelete
                          client={client}
                          scope={scope}
                          selection={selection}
                          labels={labels}
                          disabled={disabled}
                          onDeleted={() => {
                            refresh();
                            onChanged?.();
                            notify(labels.deleted);
                          }}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {(!!error || !data?.items.length) && (
                <tr>
                  <td
                    colSpan={5 + (capabilities?.delete ? 1 : 0)}
                    className={cn(tableCellClass, "py-8")}
                  >
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
              {data &&
                retainRemovedItems(data.items, listing.data?.items ?? [], optimistic.pending).map(
                  (entry) => (
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
                            disabled={disabled || entry.id.startsWith("pending-")}
                          />
                        </td>
                      )}
                      <td className={cn(tableCellClass, "max-w-64 break-all")}>
                        {entry.name}
                        {entry.state === "deleting" && (
                          <output className="mt-1 block text-xs text-muted-foreground">
                            {labels.deleting}
                          </output>
                        )}
                      </td>
                      <td
                        className={cn(tableCellClass, "max-w-64 break-all text-muted-foreground")}
                      >
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
                        <div className={tableActionsClass}>
                          {data.space.capabilities.restore && entry.state === "trashed" && (
                            <button
                              className={buttonClass}
                              disabled={
                                disabled || Date.parse(entry.expiresAt) <= (listing.loadedAt ?? 0)
                              }
                              onClick={() => void restore(entry)}
                            >
                              <RotateCcwIcon aria-hidden="true" />
                              {restoring === entry.id ? labels.pending : labels.restore}
                            </button>
                          )}
                          {data.space.capabilities.delete && (
                            <EntryDialog
                              client={{
                                ...client,
                                deleteEntry: (input) =>
                                  optimistic.run(
                                    (current) =>
                                      current && {
                                        ...current,
                                        items: current.items.filter(
                                          (row) => row.id !== input.entryId,
                                        ),
                                      },
                                    () => client.deleteEntry(input),
                                  ),
                              }}
                              scope={scope}
                              parentId={null}
                              entry={entry}
                              deleting
                              disabled={disabled}
                              labels={labels}
                              refresh={() => {
                                refresh();
                                notify(labels.deleted);
                              }}
                            >
                              <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
                            </EntryDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
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
          disabled={disabled}
          onPrevious={() => setCursors(cursors.slice(0, -1))}
          onNext={() => {
            if (data?.nextCursor) setCursors([...cursors, data.nextCursor]);
          }}
        />
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
          onRestore={(input) =>
            optimistic.run(
              (current) =>
                current && {
                  ...current,
                  items: current.items.filter((row) => row.id !== input.entryId),
                },
              () => client.restoreEntry!(input),
            )
          }
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
  onRestore,
}: {
  client: DriveClient;
  scope: DriveScope;
  entry: DriveTrashEntry;
  labels: DriveLabels;
  canRename: boolean;
  disabled: boolean;
  close: () => void;
  restored: () => void;
  onRestore: NonNullable<DriveClient["restoreEntry"]>;
}) {
  const [name, setName] = useState(entry.name);
  const [destination, setDestination] = useState<string | null>();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>(labels.RESTORE_CONFLICT);
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) =>
      client.listEntries({ scope, parentId: destination ?? null, cursor, signal }),
    [client, scope, destination, cursor],
  );
  const { data: folder, loading, error: failure } = useDriveListing(load, revision);
  const folderError = failure ? messageFor(failure, labels) : undefined;
  const lock = useRef(false);
  const fieldId = `factory-drive-restore-${useId()}`;
  async function submit() {
    if (disabled || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await onRestore({
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
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto py-0 shadow-xl",
          )}
        >
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-card px-6 pt-5 pb-2"
          >
            <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
              {labels.restoreTitle}
            </Dialog.Title>
            <IconTooltip label={labels.close}>
              <Dialog.Close
                type="button"
                aria-label={labels.close}
                disabled={pending}
                className={iconButtonClass}
              >
                <XIcon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.restoreDescription}
          </Dialog.Description>
          <form
            className="contents space-y-4"
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
                disabled={pending || disabled || loading || !!folderError}
                onChange={(event) => {
                  setDestination(
                    event.target.value === "original"
                      ? undefined
                      : event.target.value === "root"
                        ? null
                        : event.target.value,
                  );
                  setCursors([]);
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
                <TablePagination
                  className="mt-0"
                  label={labels.destination}
                  page={cursors.length + 1}
                  previousLabel={labels.previous}
                  nextLabel={labels.next}
                  previousDisabled={cursors.length === 0}
                  nextDisabled={!folder?.nextCursor || !!folderError}
                  disabled={loading || pending || !!folderError}
                  onPrevious={() => setCursors(cursors.slice(0, -1))}
                  onNext={() => {
                    if (folder?.nextCursor) setCursors([...cursors, folder.nextCursor]);
                  }}
                />
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
            <div
              data-dialog-footer
              className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-card px-6 pt-0 pb-5"
            >
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
