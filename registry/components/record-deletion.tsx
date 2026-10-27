"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEventHandler, type RefObject } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

const buttonClass =
  "inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8";
const destructiveClass =
  "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted disabled:hover:text-muted-foreground dark:disabled:bg-muted dark:disabled:hover:bg-muted";

export interface RecordDeletionLabels {
  deleteDescription: (name: string) => string;
  cancel: string;
  close?: string;
  confirmDelete: string;
  pending: string;
  deleted: string;
  actionError: string;
}

export interface RecordDeletionOptions<T extends { id: string }> {
  items: readonly T[];
  getName: (item: T) => string;
  onDelete?: (id: string) => Promise<void>;
  label: string;
  labels: RecordDeletionLabels;
  scope?: string;
  disabled?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
  onPendingChange?: (pending: boolean) => void;
  className?: string;
}

/** Own confirmation outside removable rows; host data remains authoritative. */
export function useRecordDeletion<T extends { id: string }>({
  items,
  getName,
  onDelete,
  label,
  labels,
  scope = "",
  disabled = false,
  returnFocus,
  onPendingChange,
  className,
}: RecordDeletionOptions<T>) {
  const optimistic = useOptimisticAction(items, scope);
  const notify = useActionToast();
  const lock = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const trigger = useRef<{ element: HTMLElement; id: string; scope: string } | null>(null);
  const [session, setSession] = useState<{
    id: string;
    name: string;
    scope: string;
    submitted: boolean;
    error?: string;
  } | null>(null);
  const pending = !!session?.submitted && !session.error;
  const current =
    session?.scope === scope ? items.find((item) => item.id === session.id) : undefined;
  if (session && !session.submitted && (!current || session.scope !== scope || !onDelete)) {
    setSession(null);
  } else if (session && current && session.name !== getName(current)) {
    setSession({ ...session, name: getName(current) });
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function confirm() {
    if (lock.current || disabled || !session || !current || !onDelete) return;
    const target = { ...session, name: getName(current), submitted: true, error: undefined };
    lock.current = true;
    setSession(target);
    onPendingChange?.(true);
    try {
      await optimistic.run(
        (rows) => rows.filter((row) => row.id !== target.id),
        () => onDelete(target.id),
      );
      if (mounted.current) {
        setSession(null);
        notify(labels.deleted);
      }
    } catch {
      if (mounted.current)
        setSession((previous) => previous && { ...previous, error: labels.actionError });
    } finally {
      lock.current = false;
      if (mounted.current) onPendingChange?.(false);
    }
  }

  return {
    items: optimistic.value,
    pending,
    open(id: string, element: HTMLElement) {
      if (lock.current || disabled || !onDelete) return;
      const item = items.find((row) => row.id === id);
      if (!item) return;
      trigger.current = { element, id, scope };
      setSession({ id, name: getName(item), scope, submitted: false });
    },
    dialog: (
      <Dialog.Root
        open={!!session}
        onOpenChange={(open) => {
          if (!open && !lock.current) setSession(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            initialFocus={cancelRef}
            className={cn(
              "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto rounded-xl border border-border bg-card px-6 text-card-foreground shadow-xl",
              className,
            )}
            finalFocus={() => {
              const original = trigger.current;
              const button = original?.element;
              if (
                original?.scope === scope &&
                items.some((item) => item.id === original.id) &&
                button?.isConnected &&
                button.getClientRects().length &&
                !button.matches(":disabled")
              )
                return button;
              // Base UI otherwise picks the container's first tabbable child.
              const fallback = returnFocus?.current;
              queueMicrotask(() => {
                if (fallback?.isConnected) fallback.focus({ preventScroll: true });
              });
              return false;
            }}
          >
            <div
              data-dialog-header
              className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-card px-6 pt-5 pb-2"
            >
              <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
                {label}
              </Dialog.Title>
              <IconTooltip label={labels.close ?? labels.cancel}>
                <Dialog.Close
                  type="button"
                  aria-label={labels.close ?? labels.cancel}
                  disabled={pending}
                  className={cn(buttonClass, "size-10 p-0 md:size-8")}
                >
                  <XIcon className="size-4 shrink-0" aria-hidden="true" />
                </Dialog.Close>
              </IconTooltip>
            </div>
            <Dialog.Description className="mb-0 text-sm break-words text-muted-foreground">
              {session && labels.deleteDescription(current ? getName(current) : session.name)}
            </Dialog.Description>
            <div className="min-h-5 text-sm text-destructive">
              {session?.error && <p role="alert">{session.error}</p>}
            </div>
            <div
              data-dialog-footer
              className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-card px-6 pt-0 pb-5"
            >
              <Dialog.Close
                ref={cancelRef}
                className={cn(buttonClass, "border border-border")}
                disabled={pending}
              >
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                className={cn(buttonClass, destructiveClass)}
                disabled={disabled || pending || !current || !onDelete}
                aria-busy={pending}
                onClick={() => void confirm()}
              >
                {pending ? labels.pending : labels.confirmDelete}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
  };
}

export interface RecordDeleteButtonProps {
  label: string;
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

export function RecordDeleteButton({
  label,
  disabled,
  onClick,
  className,
}: RecordDeleteButtonProps) {
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          buttonClass,
          destructiveClass,
          "size-10 min-h-10 border border-border p-0 md:size-8 md:min-h-8",
          className,
        )}
      >
        <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}
