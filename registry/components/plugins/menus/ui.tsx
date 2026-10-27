"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { editorInvalidClass } from "@/components/utils/editor-form";

export const field = cn(
  "min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm",
  editorInvalidClass,
);
export const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors md:min-h-8 text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
export const outlineButton = cn(button, "border border-border");
export const primary = cn(
  button,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
export const page = "mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-foreground";
export const iconButton = cn(
  button,
  "size-10 min-h-10 shrink-0 border border-border bg-background p-0 md:size-8 md:min-h-8",
);
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function DeleteControl({
  label,
  confirm,
  cancel,
  closeLabel,
  errorMessage,
  onDelete,
  onDone,
  disabled = false,
}: {
  label: string;
  confirm: string;
  cancel: string;
  closeLabel?: string;
  errorMessage: string;
  onDelete: () => Promise<void>;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <IconTooltip label={label}>
        <Dialog.Trigger
          className={cn(
            iconButton,
            "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
          )}
          disabled={disabled || pending}
          aria-label={label}
        >
          <Trash2Icon aria-hidden="true" className="size-4 shrink-0" />
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto rounded-2xl border border-border bg-popover px-6 text-popover-foreground shadow-xl">
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-popover px-6 pt-5 pb-2"
          >
            <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
              {label}
            </Dialog.Title>
            <IconTooltip label={closeLabel ?? cancel}>
              <Dialog.Close
                type="button"
                aria-label={closeLabel ?? cancel}
                disabled={pending}
                className={iconButton}
              >
                <XIcon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <Dialog.Description className="text-sm text-muted-foreground">
            {confirm}?
          </Dialog.Description>
          {error ? <ErrorMessage message={errorMessage} /> : null}
          <div
            data-dialog-footer
            className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-popover px-6 pt-0 pb-5"
          >
            <Dialog.Close className={outlineButton} disabled={pending}>
              {cancel}
            </Dialog.Close>
            <button
              type="button"
              className={cn(
                primary,
                "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
              )}
              disabled={disabled || pending}
              onClick={() => {
                if (disabled || lock.current) return;
                lock.current = true;
                setPending(true);
                setError(false);
                void onDelete()
                  .then(() => {
                    setOpen(false);
                    onDone?.();
                  })
                  .catch(() => setError(true))
                  .finally(() => {
                    lock.current = false;
                    setPending(false);
                  });
              }}
            >
              {confirm}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
