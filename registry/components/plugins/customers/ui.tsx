"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type { Customer } from "@/components/plugins/customers/types";
import { customerDisplayName, customerInitials } from "@/components/plugins/customers/utils";
import { cn } from "@/components/utils/cn";

export const cardClass = "rounded-3xl border border-border bg-background p-5 text-foreground";
export const buttonClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4";
export const primaryButtonClass = cn(
  buttonClass,
  "bg-primary text-primary-foreground hover:bg-primary/90",
);
export const inputClass =
  "h-8 w-full min-w-0 rounded-2xl border border-input bg-muted px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-red-600 md:text-sm";

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
      className={cn(
        "text-sm",
        feedback.error ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
      )}
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
        className={buttonClass}
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
          className={cn(buttonClass, "text-destructive")}
          aria-label={labels.deleteCustomer}
          disabled={action.pending}
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
            <Dialog.Title className="text-lg font-semibold">{labels.deleteCustomer}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.deleteDescription(customerDisplayName(customer))}
            </Dialog.Description>
            <Feedback feedback={action.feedback} />
            <div className="flex justify-end gap-2">
              <Dialog.Close className={buttonClass} disabled={action.pending}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={action.pending}
                className={cn(buttonClass, "bg-red-600 text-white hover:bg-red-700")}
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
