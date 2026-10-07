"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type { Customer } from "@/components/plugins/customers/types";
import { customerDisplayName, customerInitials } from "@/components/plugins/customers/utils";
import { cn } from "@/components/utils/cn";

export const cardClass = "rounded-xl border border-border bg-card p-6 text-card-foreground";
export const buttonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors md:min-h-8 text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
export const primaryButtonClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
export const outlineButtonClass = cn(buttonClass, "border border-border");
export const iconButtonClass = cn(
  buttonClass,
  "size-10 min-h-10 border border-border bg-background p-0 md:size-8 md:min-h-8",
);
export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm";

export function useCustomerAction(errorMessage: string) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  async function run(action: () => Promise<void>, success: string) {
    if (lock.current) return false;
    lock.current = true;
    setPending(true);
    setFeedback(undefined);
    try {
      await action();
      setFeedback({ error: false, message: success });
      return true;
    } catch {
      setFeedback({ error: true, message: errorMessage });
      return false;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, feedback, run };
}

export function Feedback({ feedback }: { feedback?: { error: boolean; message: string } }) {
  return feedback ? (
    <p
      role={feedback.error ? "alert" : "status"}
      className={cn("text-sm", feedback.error ? "text-destructive" : "text-muted-foreground")}
    >
      {feedback.message}
    </p>
  ) : null;
}

export function CustomerAvatar({
  customer,
  large = false,
}: {
  customer: Customer;
  large?: boolean;
}) {
  const name = customerDisplayName(customer);
  return (
    <Avatar.Root
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border",
        large && "size-16 text-xl",
      )}
    >
      <Avatar.Image
        src={customer.image ?? undefined}
        alt={name}
        className="size-full object-cover"
      />
      <Avatar.Fallback>{customerInitials(name, customer.email)}</Avatar.Fallback>
    </Avatar.Root>
  );
}

export function CustomerActionButton({
  label,
  onAction,
  labels,
  children,
}: {
  label: string;
  onAction: () => Promise<void>;
  labels: CustomersLabels;
  children: ReactNode;
}) {
  const action = useCustomerAction(labels.actionError);
  return (
    <div>
      <button
        type="button"
        className={iconButtonClass}
        aria-label={label}
        disabled={action.pending}
        aria-busy={action.pending}
        onClick={() => void action.run(onAction, labels.actionSuccess)}
      >
        {children}
      </button>
      <Feedback feedback={action.feedback} />
    </div>
  );
}

export function DeleteCustomer({
  customer,
  onDelete,
  labels,
}: {
  customer: Customer;
  onDelete: (id: string) => Promise<void>;
  labels: CustomersLabels;
}) {
  const [open, setOpen] = useState(false);
  const action = useCustomerAction(labels.actionError);
  return (
    <div>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!action.pending) setOpen(next);
        }}
      >
        <Dialog.Trigger
          className={cn(
            iconButtonClass,
            "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
          )}
          aria-label={labels.deleteCustomer}
          disabled={action.pending}
        >
          <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            className={cn(
              cardClass,
              "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-5 shadow-xl",
            )}
          >
            <Dialog.Title className="text-lg font-semibold">{labels.deleteCustomer}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.deleteDescription(customerDisplayName(customer))}
            </Dialog.Description>
            <Feedback feedback={action.feedback} />
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close className={outlineButtonClass} disabled={action.pending}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={action.pending}
                className={cn(
                  buttonClass,
                  "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                )}
                onClick={async () => {
                  if (await action.run(() => onDelete(customer.id), labels.deleted)) setOpen(false);
                }}
              >
                {action.pending ? labels.pending : labels.confirmDelete}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {!open && <Feedback feedback={action.feedback} />}
    </div>
  );
}
