"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import type { BlogsLabels } from "@/components/plugins/blogs/labels";
import { TablePagination } from "@/components/table-pagination";
import { cn } from "@/components/utils/cn";
import { editorInvalidClass } from "@/components/utils/editor-form";

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
export const inputClass = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm",
  editorInvalidClass,
);
export const cardClass = "rounded-xl border border-border bg-card p-6 text-card-foreground";
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
  const notify = useActionToast();
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
      if (success) notify(success);
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
      <IconTooltip label={label}>
        <Dialog.Trigger
          className={cn(
            iconButtonClass,
            "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
          )}
          aria-label={label}
          disabled={disabled}
        >
          <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
        </Dialog.Trigger>
      </IconTooltip>
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
          <div className="min-h-10">
            <Feedback {...action.feedback} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Close className={outlineButtonClass} disabled={action.pending}>
              {labels.cancel}
            </Dialog.Close>
            <button
              className={cn(
                primaryClass,
                "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
              )}
              disabled={disabled || action.pending}
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
  disabled = false,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  labels: BlogsLabels;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <TablePagination
      summary={`${total} ${labels.totalItems}`}
      page={page}
      pageCount={pages}
      label={labels.pageLabel(page, pages)}
      previousLabel={labels.previous}
      nextLabel={labels.next}
      previousDisabled={page <= 1}
      nextDisabled={page >= pages}
      disabled={disabled}
      onPrevious={() => onPageChange(page - 1)}
      onNext={() => onPageChange(page + 1)}
    />
  );
}
