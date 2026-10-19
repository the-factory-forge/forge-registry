"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import {
  tableSelectionLabels,
  type TableSelectionLabels,
} from "@/components/utils/table-selection-labels";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";
export type { TableSelectionLabels } from "@/components/utils/table-selection-labels";

export function useTableSelection<T extends { id: string }>(items: readonly T[], scope = "") {
  const [state, setState] = useState({ ids: [] as string[], scope });
  const [pending, setPending] = useState(false);
  const deletion = useOptimisticAction<string | undefined>(undefined, scope);
  const selected = items.filter((item) => state.scope === scope && state.ids.includes(item.id));
  if (state.scope !== scope || selected.length !== state.ids.length) {
    setState({ ids: selected.map((item) => item.id), scope });
  }
  return {
    selected,
    scope,
    pending,
    setPending,
    isDeleting: (id: string) => deletion.pending && deletion.value === id,
    delete: (id: string, action: () => Promise<unknown>) => deletion.run(() => id, action),
    all: items.length > 0 && selected.length === items.length,
    mixed: selected.length > 0 && selected.length < items.length,
    toggleAll: (checked: boolean) =>
      setState({ ids: checked ? items.map((item) => item.id) : [], scope }),
    toggle: (id: string, checked: boolean) =>
      setState((current) => ({
        scope,
        ids: checked
          ? [...current.ids.filter((value) => value !== id), id]
          : current.ids.filter((value) => value !== id),
      })),
    remove: (id: string) =>
      setState((current) => ({ ...current, ids: current.ids.filter((value) => value !== id) })),
  };
}

export interface TableSelectionCheckboxProps {
  label: string;
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}
export function TableSelectionCheckbox({
  label,
  checked,
  mixed = false,
  disabled,
  onChange,
}: TableSelectionCheckboxProps) {
  return (
    <label className="inline-flex size-10 items-center justify-center md:size-8">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(input) => {
          if (input) input.indeterminate = mixed;
        }}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

const buttonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8";
const destructiveClass =
  "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30";

export interface TableBulkDeleteProps<T extends { id: string }> {
  selection: ReturnType<typeof useTableSelection<T>>;
  getName: (item: T) => string;
  onDelete: (item: T, requestId: string) => Promise<unknown>;
  /** Fetch and display any server-owned deletion preview before allowing confirmation. */
  prepare?: (items: readonly T[]) => Promise<ReactNode>;
  errorMessage?: (error: unknown) => string;
  description?: ReactNode;
  labels?: Partial<TableSelectionLabels>;
  disabled?: boolean;
}
export function TableBulkDelete<T extends { id: string }>({
  selection,
  getName,
  onDelete,
  prepare,
  errorMessage,
  description,
  labels: overrides,
  disabled,
}: TableBulkDeleteProps<T>) {
  const labels = { ...tableSelectionLabels, ...overrides };
  const [deleting, setDeleting] = useState<{ item: T; requestId: string }[]>([]);
  const [details, setDetails] = useState<ReactNode>();
  const [ready, setReady] = useState(!prepare);
  const [failure, setFailure] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!lock.current) setDeleting([]);
  }, [selection.scope]);
  const notify = useActionToast();
  async function prepareDeletion(entries: typeof deleting) {
    setReady(false);
    setDetails(undefined);
    try {
      const next = await prepare?.(entries.map(({ item }) => item));
      if (mounted.current) {
        setDetails(next);
        setReady(true);
      }
    } catch (error) {
      if (mounted.current) setFailure(errorMessage?.(error) ?? labels.bulkPrepareError);
    }
  }
  async function open() {
    if (lock.current || disabled || !selection.selected.length) return;
    const entries = selection.selected.map((item) => ({ item, requestId: crypto.randomUUID() }));
    setDeleting(entries);
    setFailure("");
    lock.current = true;
    selection.setPending(true);
    try {
      await prepareDeletion(entries);
    } finally {
      lock.current = false;
      selection.setPending(false);
    }
  }
  const actionLabel = `${labels.deleteSelected} (${selection.selected.length})`;
  const actionDisabled = disabled || selection.pending || selection.selected.length === 0;
  return (
    <>
      <div className="size-10 shrink-0 md:size-8">
        <IconTooltip label={actionLabel}>
          <button
            type="button"
            aria-label={actionLabel}
            className={cn(
              buttonClass,
              actionDisabled
                ? "bg-background text-foreground disabled:hover:bg-background"
                : destructiveClass,
              "size-10 p-0 md:size-8",
            )}
            disabled={actionDisabled}
            onClick={() => void open()}
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      <Dialog.Root
        open={deleting.length > 0}
        onOpenChange={(open) => {
          if (!open && !lock.current) setDeleting([]);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
            <Dialog.Title className="text-lg font-semibold">{labels.bulkDeleteTitle}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {description ?? labels.bulkDeleteDescription}
            </Dialog.Description>
            <ul className="max-h-48 list-inside list-disc overflow-y-auto text-sm">
              {deleting.map(({ item }) => (
                <li key={item.id} className="break-words">
                  {getName(item)}
                </li>
              ))}
            </ul>
            {prepare && (
              <div className="h-32 overflow-y-auto" aria-busy={selection.pending && !ready}>
                {details ??
                  (selection.pending && (
                    <output className="block text-sm text-muted-foreground">
                      {labels.bulkPending}
                    </output>
                  ))}
              </div>
            )}
            <div className="h-12 overflow-y-auto text-sm text-destructive">
              {failure && <p role="alert">{failure}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close className={buttonClass} disabled={selection.pending}>
                {labels.bulkCancel}
              </Dialog.Close>
              <button
                type="button"
                className={cn(buttonClass, destructiveClass)}
                disabled={disabled || selection.pending}
                onClick={async () => {
                  if (lock.current || disabled) return;
                  lock.current = true;
                  selection.setPending(true);
                  setFailure("");
                  const failed: typeof deleting = [];
                  let reason: unknown;
                  try {
                    if (!ready) {
                      await prepareDeletion(deleting);
                      return;
                    }
                    for (const entry of deleting) {
                      if (!mounted.current) break;
                      try {
                        await selection.delete(entry.item.id, () =>
                          onDelete(entry.item, entry.requestId),
                        );
                        selection.remove(entry.item.id);
                      } catch (error) {
                        failed.push(entry);
                        reason = error;
                      }
                    }
                    if (!mounted.current) return;
                    setDeleting(failed);
                    if (failed.length) {
                      setFailure(errorMessage?.(reason) ?? labels.bulkDeleteError);
                      await prepareDeletion(failed);
                    } else if (labels.bulkDeleted) notify(labels.bulkDeleted);
                  } finally {
                    lock.current = false;
                    selection.setPending(false);
                  }
                }}
              >
                {selection.pending
                  ? labels.bulkPending
                  : ready
                    ? labels.bulkConfirm
                    : labels.bulkRetry}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
