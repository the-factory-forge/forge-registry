"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { Image } from "@/components/image";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveClient,
  DriveDeletePreview,
  DriveEntry,
  DriveScope,
  DriveSort,
  DriveSpace,
} from "@/components/plugins/drive/types";
import { errorCode, validName } from "@/components/plugins/drive/utils";
import { cn } from "@/components/utils/cn";
import { tableHeaderClass } from "@/components/utils/table-styles";

export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";
export const primaryClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
export const outlineButtonClass = cn(buttonClass, "border border-border");
export const iconButtonClass = cn(buttonClass, "size-8 min-h-8 shrink-0 p-0");
export const inputClass =
  "h-9 w-full min-w-0 rounded-2xl border border-input bg-muted px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
export const cardClass = "rounded-3xl border border-border bg-background p-5 text-foreground";
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

export function EntryDialog({
  client,
  scope,
  parentId,
  entry,
  deleting = false,
  labels,
  refresh,
  children,
}: {
  client: DriveClient;
  scope: DriveScope;
  parentId: string | null;
  entry?: DriveEntry;
  deleting?: boolean;
  labels: DriveLabels;
  refresh: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry?.name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<DriveDeletePreview>();
  const lock = useRef(false);
  const fieldId = useId();
  const title = deleting ? labels.deleteTitle : entry ? labels.rename : labels.newFolder;
  async function loadPreview() {
    if (!entry || lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setPreview(undefined);
    try {
      setPreview(await client.previewDelete({ scope, entryId: entry.id }));
    } catch (reason) {
      setError(messageFor(reason, labels));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function submit() {
    if (lock.current || (deleting && !preview)) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      if (deleting && entry && preview)
        await client.deleteEntry({ scope, entryId: entry.id, token: preview.token });
      else if (entry) await client.rename({ scope, entryId: entry.id, name: validName(name) });
      else await client.createFolder({ scope, parentId, name: validName(name) });
      setOpen(false);
      refresh();
    } catch (reason) {
      setError(messageFor(reason, labels));
      if (deleting && errorCode(reason) === "CONFLICT") setPreview(undefined);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (lock.current) return;
        setOpen(next);
        if (next) {
          setName(entry?.name ?? "");
          setError(undefined);
          if (deleting) void loadPreview();
        }
      }}
    >
      <Dialog.Trigger
        className={cn(
          entry ? iconButtonClass : buttonClass,
          deleting && "text-destructive hover:text-destructive",
        )}
        aria-label={deleting ? labels.delete : entry ? labels.rename : labels.newFolder}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          className={cn(
            cardClass,
            "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-5 shadow-xl",
          )}
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {deleting
              ? preview && entry
                ? labels.deleteDescription(entry.name, preview.files, preview.folders)
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
                  disabled={pending}
                />
              </div>
            )}
            <DriveFeedback message={error} error />
            <div className="flex justify-end gap-2">
              <Dialog.Close className={outlineButtonClass} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              {deleting && !preview ? (
                <button
                  type="button"
                  className={primaryClass}
                  disabled={pending}
                  onClick={() => void loadPreview()}
                >
                  {pending ? labels.pending : labels.retry}
                </button>
              ) : (
                <button
                  type="submit"
                  className={cn(
                    primaryClass,
                    deleting &&
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
                  )}
                  disabled={pending}
                >
                  {pending
                    ? labels.pending
                    : deleting
                      ? labels.confirmDelete
                      : entry
                        ? labels.save
                        : labels.create}
                </button>
              )}
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
