"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import type { BlogsLabels } from "@/components/plugins/blogs/labels";
import { cn } from "@/components/utils/cn";
import { tableFooterClass } from "@/components/utils/table-styles";

export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";
export const primaryClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
export const outlineButtonClass = cn(buttonClass, "border border-border");
export const iconButtonClass = cn(buttonClass, "size-8 min-h-8 shrink-0 p-0");
export const inputClass =
  "h-10 w-full min-w-0 rounded-2xl border border-input bg-muted px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
export const cardClass = "rounded-3xl border border-border bg-background p-5 text-foreground";
export const pageClass = "mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6";
export function errorMessage(error: unknown, labels: BlogsLabels) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["INVALID", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "IN_USE", "STORAGE"].includes(code)
    ? labels[code as "INVALID"]
    : labels.error;
}
export function Feedback({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? (
    <p
      role={error ? "alert" : "status"}
      className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
    >
      {message}
    </p>
  ) : null;
}
export function useBlogAction(labels: BlogsLabels) {
  const lock = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  async function run<T>(
    key: string,
    action: (requestId: string) => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFeedback(undefined);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const result = await action(request.current.id);
      request.current = null;
      if (success) setFeedback({ message: success });
      return result;
    } catch (error) {
      setFeedback({ message: errorMessage(error, labels), error: true });
      return undefined;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, feedback, run };
}
export function ConfirmDelete({
  labels,
  title,
  description,
  onDelete,
  disabled = false,
  label,
}: {
  labels: BlogsLabels;
  title: string;
  description: string;
  onDelete: (requestId: string) => Promise<void>;
  disabled?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const action = useBlogAction(labels);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!action.pending) setOpen(next);
      }}
    >
      <Dialog.Trigger
        className={cn(iconButtonClass, "text-destructive hover:text-destructive")}
        aria-label={label}
        disabled={disabled}
      >
        <Trash2Icon aria-hidden="true" />
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
            {description}
          </Dialog.Description>
          <Feedback {...action.feedback} />
          <div className="flex justify-end gap-2">
            <Dialog.Close className={outlineButtonClass} disabled={action.pending}>
              {labels.cancel}
            </Dialog.Close>
            <button
              className={cn(
                primaryClass,
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
              )}
              disabled={action.pending}
              onClick={() =>
                void action.run("delete", async (requestId) => {
                  await onDelete(requestId);
                  setOpen(false);
                  return true;
                })
              }
            >
              {action.pending ? labels.pending : labels.confirmDelete}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
  labels,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  labels: BlogsLabels;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={labels.pageLabel(page, pages)} className={tableFooterClass}>
      <span className="text-sm text-muted-foreground">
        {total} {labels.totalItems}
      </span>
      <button
        type="button"
        className={cn(buttonClass, "size-9 border border-border p-0")}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={labels.previous}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </button>
      <span className="min-w-9 text-center text-sm text-muted-foreground tabular-nums">
        {page}/{pages}
      </span>
      <button
        type="button"
        className={cn(buttonClass, "size-9 border border-border p-0")}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        aria-label={labels.next}
      >
        <ChevronRightIcon aria-hidden="true" />
      </button>
    </nav>
  );
}
