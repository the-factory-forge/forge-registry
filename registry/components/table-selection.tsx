"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import {
  tableSelectionLabels,
  type TableSelectionLabels,
} from "@/components/utils/table-selection-labels";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";
export type { TableSelectionLabels } from "@/components/utils/table-selection-labels";

export interface TableDeletionOptions<T> {
  onDelete: (item: T, requestId: string) => Promise<unknown>;
  prepare?: (items: readonly T[]) => Promise<ReactNode>;
  onComplete?: (count: number) => void;
}
interface DeletionSession<T> {
  scope: string;
  options: TableDeletionOptions<T>;
  entries: { item: T; requestId: string }[];
  phase: "preparing" | "ready" | "deleting";
  ready: boolean;
  details?: ReactNode;
  failure?: { stage: "prepare" | "delete"; cause: unknown };
  attempted: number;
}

export function useTableSelection<T extends { id: string }>(items: readonly T[], scope = "") {
  const [state, setState] = useState({ ids: [] as string[], scope });
  const [session, setSession] = useState<DeletionSession<T> | null>(null);
  const active = useRef<DeletionSession<T> | null>(null);
  const requestPending = useRef(false);
  const mounted = useRef(true);
  const currentScope = useRef(scope);
  const optimistic = useOptimisticAction<string | undefined>(undefined, scope);
  const dispose = useCallback(() => {
    active.current = null;
    if (mounted.current) setSession(null);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    currentScope.current = scope;
    if (active.current && active.current.scope !== scope && active.current.attempted === 0)
      dispose();
  }, [scope, dispose]);
  const selected = items.filter((item) => state.scope === scope && state.ids.includes(item.id));
  if (state.scope !== scope || selected.length !== state.ids.length) {
    setState({ ids: selected.map((item) => item.id), scope });
  }
  const visible = session && (session.scope === scope || session.attempted > 0) ? session : null;
  const pending = (!!visible && visible.phase !== "ready") || optimistic.pending;
  const current = (target: DeletionSession<T>) => mounted.current && active.current === target;
  const busy = () =>
    requestPending.current || (!!active.current && active.current.phase !== "ready");
  const publish = (target: DeletionSession<T>) => {
    if (current(target)) setSession({ ...target });
  };
  async function prepare(target: DeletionSession<T>, options: TableDeletionOptions<T>) {
    target.phase = "preparing";
    target.ready = false;
    target.details = undefined;
    publish(target);
    try {
      const details = await options.prepare?.(target.entries.map(({ item }) => item));
      if (!current(target)) return;
      target.details = details;
      target.ready = true;
    } catch (cause) {
      if (!current(target)) return;
      target.failure = { stage: "prepare", cause };
    }
    target.phase = "ready";
    publish(target);
  }
  async function confirm(provided: TableDeletionOptions<T>) {
    const target = active.current;
    if (!target || busy()) return;
    const options = target.scope === currentScope.current ? provided : target.options;
    target.options = options;
    target.failure = undefined;
    if (!target.ready) return prepare(target, options);
    target.phase = "deleting";
    const entries = target.entries;
    target.attempted = entries.length;
    publish(target);
    const failed: typeof entries = [];
    let reason: unknown;
    for (const entry of entries) {
      if (!current(target)) return;
      try {
        requestPending.current = true;
        await optimistic.run(
          () => entry.item.id,
          () => options.onDelete(entry.item, entry.requestId),
        );
        if (current(target))
          setState((previous) =>
            previous.scope === target.scope
              ? { ...previous, ids: previous.ids.filter((id) => id !== entry.item.id) }
              : previous,
          );
      } catch (error) {
        failed.push(entry);
        reason = error;
      } finally {
        requestPending.current = false;
      }
    }
    if (!current(target)) return;
    if (!failed.length) {
      dispose();
      options.onComplete?.(entries.length);
    } else {
      target.entries = failed;
      target.failure = { stage: "delete", cause: reason };
      await prepare(target, options);
    }
  }
  return {
    selected,
    scope,
    pending,
    isDeleting: (id: string) =>
      visible?.scope === scope && optimistic.pending && optimistic.value === id,
    deletion: {
      items: visible?.entries.map(({ item }) => item) ?? [],
      details: visible?.details,
      ready: visible?.ready ?? false,
      failure: visible?.failure,
      attempted: visible?.attempted ?? 0,
      open(options: TableDeletionOptions<T>, targets: readonly T[] = selected) {
        if (busy() || !targets.length) return;
        const target: DeletionSession<T> = {
          scope,
          options,
          entries: targets.map((item) => ({ item, requestId: crypto.randomUUID() })),
          phase: "preparing",
          ready: false,
          attempted: 0,
        };
        active.current = target;
        void prepare(target, options);
      },
      confirm,
      close() {
        if (!busy()) dispose();
      },
      /** A dialog can unmount while its table remains mounted. */
      dispose,
    },
    all: items.length > 0 && selected.length === items.length,
    mixed: selected.length > 0 && selected.length < items.length,
    toggleAll: (checked: boolean) => {
      if (!busy()) setState({ ids: checked ? items.map((item) => item.id) : [], scope });
    },
    toggle: (id: string, checked: boolean) => {
      if (busy()) return;
      setState((current) => ({
        scope,
        ids: checked
          ? [...current.ids.filter((value) => value !== id), id]
          : current.ids.filter((value) => value !== id),
      }));
    },
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
  const { deletion } = selection;
  useEffect(() => deletion.dispose, [deletion.dispose]);
  const notify = useActionToast();
  const options: TableDeletionOptions<T> = {
    onDelete,
    prepare,
    onComplete: () => {
      if (labels.bulkDeleted) notify(labels.bulkDeleted);
    },
  };
  const failure = deletion.failure
    ? (errorMessage?.(deletion.failure.cause) ??
      (deletion.failure.stage === "prepare" ? labels.bulkPrepareError : labels.bulkDeleteError))
    : "";
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
            onClick={() => {
              if (!actionDisabled) deletion.open(options);
            }}
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      <Dialog.Root
        open={deletion.items.length > 0}
        onOpenChange={(open) => {
          if (!open) deletion.close();
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
              {deletion.items.map((item) => (
                <li key={item.id} className="break-words">
                  {getName(item)}
                </li>
              ))}
            </ul>
            {prepare && (
              <div
                className="h-32 overflow-y-auto"
                aria-busy={selection.pending && !deletion.ready}
              >
                {deletion.details ??
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
                onClick={() => {
                  if (!disabled) void deletion.confirm(options);
                }}
              >
                {selection.pending
                  ? labels.bulkPending
                  : deletion.ready
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
