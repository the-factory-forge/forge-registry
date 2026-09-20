"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import type { BlogsLabels } from "@/components/plugins/blogs/labels";
import { cn } from "@/components/utils/cn";

export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4";
export const primaryClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90",
);
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
        className={cn(buttonClass, "size-9 shrink-0 p-0 text-destructive")}
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
            <Dialog.Close className={buttonClass} disabled={action.pending}>
              {labels.cancel}
            </Dialog.Close>
            <button
              className={cn(
                primaryClass,
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
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
    <nav
      aria-label={labels.pageLabel(page, pages)}
      className="flex items-center justify-between gap-3"
    >
      <button className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {labels.previous}
      </button>
      <span className="text-sm text-muted-foreground">{labels.pageLabel(page, pages)}</span>
      <button
        className={buttonClass}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        {labels.next}
      </button>
    </nav>
  );
}
