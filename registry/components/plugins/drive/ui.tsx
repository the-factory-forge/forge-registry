"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import {
  ArrowDownIcon,
  ChevronDownIcon,
  PencilIcon,
  ArrowUpDownIcon,
  RefreshCwIcon,
  ArrowUpIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  DownloadIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
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
  const { toasts, add, close } = Toast.useToastManager<{ uploads: typeof queue.uploads }>();
  const { uploads, dismiss } = queue;
  const finished = uploads.every((upload) => ["done", "cancelled"].includes(upload.state));
  const loading = uploads.some((upload) =>
    ["queued", "uploading", "finishing", "cancelling"].includes(upload.state),
  );
  useEffect(() => {
    if (!uploads.length) {
      close("drive-uploads");
      return;
    }
    add({
      id: "drive-uploads",
      type: loading ? "loading" : finished ? "success" : "error",
      title: labels.uploads,
      data: { uploads },
      timeout: finished ? 5000 : 0,
      onClose: () => {
        for (const upload of uploads) dismiss(upload.id);
      },
    });
  }, [uploads, finished, loading, labels.uploads, dismiss, add, close]);
  return (
    <Toast.Portal>
      <Toast.Viewport
        aria-label={labels.title}
        className="fixed right-0 bottom-0 z-50 flex max-h-dvh w-full max-w-[26rem] flex-col gap-2 overflow-y-auto p-4 outline-none empty:p-0 sm:right-2 sm:bottom-2 sm:max-h-[calc(100dvh-1rem)]"
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            aria-busy={toast.type === "loading"}
            swipeDirection={toast.data?.uploads && !finished ? [] : undefined}
            onKeyDownCapture={(event) => {
              if (toast.data?.uploads && !finished && event.key === "Escape")
                event.stopPropagation();
            }}
            className="flex flex-col gap-3 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring data-ending:opacity-0 data-limited:hidden motion-safe:transition-opacity dark:border dark:border-border dark:shadow-none"
          >
            <div className="flex items-center gap-3">
              {toast.type === "loading" ? (
                <LoaderCircleIcon
                  className="size-5 shrink-0 text-status-pending-foreground motion-safe:animate-spin"
                  aria-hidden="true"
                />
              ) : toast.type === "success" ? (
                <CircleCheckIcon
                  className="size-5 shrink-0 text-status-success-foreground"
                  aria-hidden="true"
                />
              ) : toast.type === "error" ? (
                <CircleAlertIcon className="size-5 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <DownloadIcon
                  className="size-5 shrink-0 text-status-info-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <Toast.Title className="text-sm break-words" />
                <Toast.Description className="mt-1 text-sm break-words text-muted-foreground" />
              </div>
              <Toast.Action
                className={cn(outlineButtonClass, "shrink-0")}
                disabled={toast.actionProps?.disabled}
              />
              {(!toast.data?.uploads || finished) && (
                <IconTooltip label={labels.close}>
                  <Toast.Close
                    aria-label={labels.close}
                    aria-hidden={false}
                    className={cn(buttonClass, "size-10 shrink-0 p-0 md:size-8")}
                  >
                    <XIcon aria-hidden="true" />
                  </Toast.Close>
                </IconTooltip>
              )}
            </div>
            {toast.data?.uploads && (
              <ul className="ms-8 max-h-[50dvh] space-y-4 overflow-y-auto">
                {toast.data.uploads.map((upload) => (
                  <li key={upload.id} className="space-y-2">
                    <span className="block text-sm break-all">{upload.file.name}</span>
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
                    <div className="flex min-h-10 flex-wrap items-center gap-2 md:min-h-8">
                      <div className="min-w-0 flex-1">
                        <DriveFeedback
                          message={labels[upload.state]}
                          error={upload.state === "failed" || upload.state === "cancelFailed"}
                        />
                      </div>
                      <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2">
                        {["failed", "cancelFailed"].includes(upload.state) && (
                          <button className={buttonClass} onClick={() => queue.retry(upload.id)}>
                            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                            {labels.retry}
                          </button>
                        )}
                        {["queued", "uploading", "failed"].includes(upload.state) && (
                          <button className={buttonClass} onClick={() => queue.cancel(upload.id)}>
                            {labels.cancel}
                          </button>
                        )}
                        {["done", "cancelled"].includes(upload.state) && (
                          <button className={buttonClass} onClick={() => dismiss(upload.id)}>
                            {labels.dismiss}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export function EntryDialog({
  client,
  scope,
  parentId,
  entry,
  space,
  onRenameSpace,
  menu = false,
  deleting = false,
  trashing = false,
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
  menu?: boolean;
  deleting?: boolean;
  trashing?: boolean;
  disabled?: boolean;
  labels: DriveLabels;
  refresh: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry?.name ?? space?.name ?? "");
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<DriveDeletePreview>();
  const previewRequest = useRef<Promise<DriveDeletePreview> | undefined>(undefined);
  const lock = useRef(false);
  const fieldId = `factory-drive-field-${useId()}`;
  const title = deleting
    ? trashing
      ? labels.trashTitle
      : labels.deleteTitle
    : entry || space
      ? labels.rename
      : labels.newFolder;
  function loadPreview() {
    if (disabled || !entry) return;
    setPreviewLoading(true);
    setError(undefined);
    setPreview(undefined);
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
      } else if (entry) await client.rename({ scope, entryId: entry.id, name: validName(name) });
      else if (space && onRenameSpace) await onRenameSpace(validName(name));
      else await client.createFolder({ scope, parentId, name: validName(name) });
      setOpen(false);
      refresh();
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
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      {menu ? (
        <DropdownMenu>
          <IconTooltip label={`${labels.actions}: ${entry?.name ?? space?.name}`}>
            <DropdownMenuTrigger
              ref={menuTrigger}
              disabled={disabled}
              className={cn(buttonClass, "size-10 shrink-0 p-0 md:size-8")}
              aria-label={`${labels.actions}: ${entry?.name ?? space?.name}`}
            >
              <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
          </IconTooltip>
          <DropdownMenuContent className="min-w-40 rounded-xl motion-reduce:animate-none">
            <DropdownMenuItem onClick={() => changeOpen(true)} className="min-h-10 rounded-md">
              <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.rename}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
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
          finalFocus={menu ? menuTrigger : undefined}
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
