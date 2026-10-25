"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import {
  ArrowDownIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  ArrowUpDownIcon,
  RefreshCwIcon,
  ArrowUpIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  ActionToastFooter,
  actionToastButtonClass,
  type ActionToastData,
} from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveBrowserProps,
  DriveClient,
  DriveDeletePreview,
  DriveEntry,
  DriveScope,
  DriveSort,
  DriveSpace,
} from "@/components/plugins/drive/types";
import type { useUploads } from "@/components/plugins/drive/use-uploads";
import { errorCode, validName } from "@/components/plugins/drive/utils";
import { cn } from "@/components/utils/cn";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";
import { tableHeaderClass } from "@/components/utils/table-styles";

export const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors md:min-h-8 text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
export const primaryClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
export const outlineButtonClass = cn(buttonClass, "border border-border");
export const iconButtonClass = cn(
  buttonClass,
  "size-10 min-h-10 shrink-0 border border-border bg-background p-0 md:size-8 md:min-h-8",
);
export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm";
export const cardClass = "rounded-xl border border-border bg-card p-6 text-card-foreground";
export const messageFor = (error: unknown, labels: DriveLabels) =>
  labels[errorCode(error) ?? "error"];

export function DriveFolderIcon({
  open = false,
  loading = false,
  className,
}: {
  open?: boolean;
  loading?: boolean;
  className?: string;
}) {
  if (loading)
    return (
      <LoaderCircleIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0 motion-safe:animate-spin", className)}
      />
    );
  return (
    <span aria-hidden="true" className={cn("grid size-4 shrink-0", className)}>
      <FolderIcon
        className={cn(
          "col-start-1 row-start-1 size-full group-hover/drive-folder:opacity-0 group-focus-visible/drive-folder:opacity-0 motion-safe:transition-opacity motion-safe:duration-150",
          open && "opacity-0",
        )}
      />
      <FolderOpenIcon
        className={cn(
          "col-start-1 row-start-1 size-full group-hover/drive-folder:opacity-100 group-focus-visible/drive-folder:opacity-100 motion-safe:transition-opacity motion-safe:duration-150",
          open ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}

export function SortHeading({
  field,
  label,
  sort,
  onSort,
}: {
  field: DriveSort["field"];
  label: string;
  sort: DriveSort;
  onSort: (sort: DriveSort) => void;
}) {
  const active = sort.field === field;
  const Icon = active ? (sort.direction === "asc" ? ArrowUpIcon : ArrowDownIcon) : ArrowUpDownIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={tableHeaderClass}
    >
      <button
        type="button"
        className={cn(buttonClass, "-ml-3 whitespace-nowrap")}
        onClick={() =>
          onSort({ field, direction: active && sort.direction === "asc" ? "desc" : "asc" })
        }
      >
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}

export function DriveModified({
  value,
  locale,
  fallback,
}: {
  value?: string;
  locale?: string;
  fallback: string;
}) {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(value),
      )}
    </time>
  );
}

export function DriveSize({
  value,
  locale,
  fallback,
}: {
  value?: number;
  locale?: string;
  fallback: string;
}) {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  const [divisor, unit]: [number, string] =
    value >= 1_000_000_000
      ? [1_000_000_000, "gigabyte"]
      : value >= 1_000_000
        ? [1_000_000, "megabyte"]
        : value >= 1_000
          ? [1_000, "kilobyte"]
          : [1, "byte"];
  return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(
    value / divisor,
  );
}

export function DriveOwner({ owner, fallback }: { owner?: DriveSpace["owner"]; fallback: string }) {
  if (!owner) return fallback;
  return (
    <span className="flex items-center gap-2">
      {owner.image && (
        <Image
          src={owner.image}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-full object-cover"
        />
      )}
      <span className="max-w-48 truncate" title={owner.name}>
        {owner.name}
      </span>
    </span>
  );
}

export function DriveFeedback({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? (
    <p
      role={error ? "alert" : "status"}
      className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
    >
      {message}
    </p>
  ) : null;
}

export function DriveToasts({
  labels,
  queue,
}: {
  labels: DriveLabels;
  queue: ReturnType<typeof useUploads>;
}) {
  const { add, close } = Toast.useToastManager<ActionToastData>();
  const id = `factory-drive-upload-toast-${useId()}`;
  const currentQueue = useRef(queue);
  useEffect(() => {
    currentQueue.current = queue;
  }, [queue]);
  const { uploads, dismiss } = queue;
  const finished = uploads.every((upload) => ["done", "cancelled"].includes(upload.state));
  const loading = uploads.some((upload) =>
    ["queued", "uploading", "finishing", "cancelling"].includes(upload.state),
  );
  useEffect(() => () => close(id), [close, id]);
  useEffect(() => {
    if (!uploads.length) {
      close(id);
      return;
    }
    add({
      id,
      type: loading ? "loading" : finished ? "success" : "error",
      title: labels.uploads,
      data: {
        closeLabel: labels.close,
        dismissible: finished,
        content: (
          <ul className="ms-8 max-h-[50dvh] space-y-4 overflow-y-auto">
            {uploads.map((upload) => (
              <li key={upload.id} className="space-y-2">
                <span className="block text-sm break-all">
                  {upload.relativePath ?? upload.file.name}
                </span>
                <progress
                  className={cn(
                    "h-2 w-full appearance-none bg-muted [&::-moz-progress-bar]:bg-current [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-current",
                    upload.state === "done"
                      ? "text-status-success-foreground"
                      : upload.state === "failed" || upload.state === "cancelFailed"
                        ? "text-destructive"
                        : upload.state === "cancelled"
                          ? "text-status-canceled-foreground"
                          : "text-status-pending-foreground",
                  )}
                  max={100}
                  value={upload.progress}
                  aria-label={labels.progress(upload.file.name)}
                />
                {upload.error !== undefined && (
                  <DriveFeedback message={messageFor(upload.error, labels)} error />
                )}
                <ActionToastFooter
                  status={
                    <DriveFeedback
                      message={labels[upload.state]}
                      error={upload.state === "failed" || upload.state === "cancelFailed"}
                    />
                  }
                  actions={
                    <>
                      {["failed", "cancelFailed"].includes(upload.state) && (
                        <button
                          className={actionToastButtonClass}
                          onClick={() => currentQueue.current.retry(upload.id)}
                        >
                          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                          {labels.retry}
                        </button>
                      )}
                      {["queued", "uploading", "failed"].includes(upload.state) && (
                        <button
                          className={actionToastButtonClass}
                          onClick={() => currentQueue.current.cancel(upload.id)}
                        >
                          {labels.cancel}
                        </button>
                      )}
                      {["done", "cancelled"].includes(upload.state) && (
                        <button
                          className={actionToastButtonClass}
                          onClick={() => dismiss(upload.id)}
                        >
                          {labels.dismiss}
                        </button>
                      )}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        ),
      },
      timeout: finished ? 5000 : 0,
      onClose: () => {
        for (const upload of uploads) dismiss(upload.id);
      },
    });
  }, [uploads, finished, loading, labels, dismiss, add, close, id]);
  return null;
}

export function DriveTitle({
  name,
  onRename,
  disabled,
  labels,
}: {
  name: string;
  onRename?: (name: string) => Promise<void>;
  disabled: boolean;
  labels: DriveLabels;
}) {
  const [draft, setDraft] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const restoreFocus = useRef(false);
  const errorId = `factory-drive-title-error-${useId()}`;
  const editing = draft !== undefined;
  const { add } = Toast.useToastManager();
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  useEffect(() => {
    if (!editing && !disabled && restoreFocus.current) {
      trigger.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing, disabled]);
  async function save(returnFocus: boolean) {
    if (disabled || lock.current || draft === undefined || !onRename) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      const next = validName(draft);
      if (next !== name) await onRename(next);
      restoreFocus.current = returnFocus;
      setDraft(undefined);
      setError(undefined);
    } catch (reason) {
      const message = messageFor(reason, labels);
      setError(message);
      add({ title: message, type: "error", data: { closeLabel: labels.close } });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <h2
      className="relative min-w-0 font-medium"
      aria-current="page"
      aria-label={name}
      aria-busy={pending}
    >
      {onRename ? (
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-label={`${labels.rename}: ${name}`}
          className={cn(
            buttonClass,
            "max-w-full justify-start px-0 text-left text-base wrap-anywhere",
            editing && "invisible",
          )}
          onClick={() => {
            setError(undefined);
            setDraft(name);
          }}
        >
          {name}
        </button>
      ) : (
        <span className="inline-flex min-h-10 items-center wrap-anywhere md:min-h-8">{name}</span>
      )}
      {editing && (
        <input
          ref={input}
          aria-label={labels.name}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          readOnly={disabled || pending || !onRename}
          className={cn(inputClass, "absolute inset-0 h-full px-0 font-medium md:text-base")}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          onBlur={() => void save(false)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              void save(true);
            } else if (event.key === "Escape" && !lock.current) {
              event.preventDefault();
              restoreFocus.current = true;
              setDraft(undefined);
              setError(undefined);
            }
          }}
        />
      )}
      {error && (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      )}
    </h2>
  );
}

export function EntryDialog({
  client,
  scope,
  parentId,
  entry,
  space,
  onRenameSpace,
  deleting = false,
  trashing = false,
  duplicating = false,
  onClose,
  returnFocus,
  disabled = false,
  labels,
  refresh,
  children,
}: {
  client: DriveClient;
  scope: DriveScope;
  parentId: string | null;
  entry?: Pick<DriveEntry, "id" | "name">;
  space?: DriveSpace;
  onRenameSpace?: DriveBrowserProps["onRenameSpace"];
  deleting?: boolean;
  trashing?: boolean;
  duplicating?: boolean;
  /** A menu can mount an already open dialog without a second trigger. */
  onClose?: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  labels: DriveLabels;
  refresh: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(!!onClose);
  const [name, setName] = useState(
    duplicating && entry ? labels.duplicateName(entry.name) : (entry?.name ?? space?.name ?? ""),
  );
  const [pending, setPending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(!!onClose && deleting);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<DriveDeletePreview>();
  const previewRequest = useRef<Promise<DriveDeletePreview> | undefined>(undefined);
  const lock = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fieldId = `factory-drive-field-${useId()}`;
  const title = deleting
    ? trashing
      ? labels.trashTitle
      : labels.deleteTitle
    : duplicating
      ? labels.duplicate
      : entry || space
        ? labels.rename
        : labels.newFolder;
  function loadPreview() {
    if (disabled || !entry) return;
    setPreviewLoading(true);
    setError(undefined);
    setPreview(undefined);
    return startPreview();
  }
  function startPreview() {
    if (!entry) return;
    const request = Promise.resolve().then(() =>
      client.previewDelete({ scope, entryId: entry.id }),
    );
    previewRequest.current = request;
    void request.then(
      (result) => {
        if (previewRequest.current !== request) return;
        setPreview(result);
        setPreviewLoading(false);
      },
      (reason) => {
        if (previewRequest.current !== request) return;
        previewRequest.current = undefined;
        setError(messageFor(reason, labels));
        setPreviewLoading(false);
      },
    );
    return request;
  }
  useEffect(() => {
    // Menu dialogs mount open; ordinary triggers prepare the preview in changeOpen.
    if (onClose && deleting) void startPreview();
    return () => {
      previewRequest.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function submit() {
    if (disabled || lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      if (deleting && entry) {
        const confirmation = preview ?? (await (previewRequest.current ?? loadPreview()));
        if (!confirmation) return;
        if (trashing)
          await client.trashEntry!({ scope, entryId: entry.id, token: confirmation.token });
        else await client.deleteEntry({ scope, entryId: entry.id, token: confirmation.token });
      } else if (duplicating && entry)
        await client.duplicateEntry!({ scope, entryId: entry.id, name: validName(name) });
      else if (entry) await client.rename({ scope, entryId: entry.id, name: validName(name) });
      else if (space && onRenameSpace) await onRenameSpace(validName(name));
      else await client.createFolder({ scope, parentId, name: validName(name) });
      setOpen(false);
      refresh();
      onClose?.();
    } catch (reason) {
      setError(messageFor(reason, labels));
      if (deleting && errorCode(reason) === "CONFLICT") {
        setPreview(undefined);
        previewRequest.current = undefined;
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function changeOpen(next: boolean) {
    if (lock.current) return;
    setOpen(next);
    if (next) {
      setName(entry?.name ?? space?.name ?? "");
      setError(undefined);
      if (deleting) void loadPreview();
    } else {
      previewRequest.current = undefined;
      setPreviewLoading(false);
      onClose?.();
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {onClose ? null : (
        <IconTooltip label={entry ? (deleting ? labels.delete : labels.rename) : undefined}>
          <Dialog.Trigger
            disabled={disabled}
            className={cn(
              entry ? iconButtonClass : buttonClass,
              deleting &&
                "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
            )}
            aria-label={deleting ? labels.delete : entry ? labels.rename : labels.newFolder}
          >
            {children}
          </Dialog.Trigger>
        </IconTooltip>
      )}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          initialFocus={deleting || disabled ? undefined : nameRef}
          finalFocus={returnFocus}
          onKeyDownCapture={deleting ? undefined : submitDialogOnShortcut}
          className={cn(
            cardClass,
            "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-5 shadow-xl",
          )}
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description
            className={cn("text-sm text-muted-foreground", deleting && "min-h-20")}
          >
            {deleting
              ? preview && entry
                ? (trashing ? labels.trashDescription : labels.deleteDescription)(
                    entry.name,
                    preview.files,
                    preview.folders,
                  )
                : entry
                  ? (trashing ? labels.trashConfirmation : labels.deleteConfirmation)(entry.name)
                  : labels.loading
              : labels.nameHint}
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {!deleting && (
              <div className="space-y-2">
                <label htmlFor={fieldId} className="text-sm font-medium">
                  {labels.name}
                </label>
                <input
                  ref={nameRef}
                  id={fieldId}
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={255}
                  required
                  disabled={pending || disabled}
                />
              </div>
            )}
            <div className={deleting ? "min-h-5" : undefined}>
              <DriveFeedback
                message={
                  error ??
                  (deleting && (pending || previewLoading)
                    ? pending
                      ? labels.pending
                      : labels.loading
                    : undefined)
                }
                error={Boolean(error)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close className={outlineButtonClass} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="submit"
                className={cn(
                  primaryClass,
                  deleting &&
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                )}
                disabled={pending || disabled}
              >
                {pending && !deleting
                  ? labels.pending
                  : deleting
                    ? trashing
                      ? labels.moveToTrash
                      : labels.confirmDelete
                    : duplicating
                      ? labels.duplicate
                      : entry || space
                        ? labels.save
                        : labels.create}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
