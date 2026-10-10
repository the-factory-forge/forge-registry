"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { useActionToast } from "@/components/action-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { IconTooltip } from "@/components/icon-tooltip";
import type { CustomersLabels } from "@/components/plugins/customers/labels";
import type { Customer } from "@/components/plugins/customers/types";
import { customerDisplayName, customerInitials } from "@/components/plugins/customers/utils";
import { cn } from "@/components/utils/cn";
import { editorInvalidClass } from "@/components/utils/editor-form";

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
export const inputClass = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm",
  editorInvalidClass,
);

export function useCustomerAction(errorMessage: string) {
  const notify = useActionToast();
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
      notify(success);
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
  disabled = false,
}: {
  label: string;
  onAction: () => Promise<void>;
  labels: CustomersLabels;
  children: ReactNode;
  disabled?: boolean;
}) {
  const action = useCustomerAction(labels.actionError);
  return (
    <div>
      <IconTooltip label={label}>
        <button
          type="button"
          className={iconButtonClass}
          aria-label={label}
          disabled={disabled || action.pending}
          aria-busy={action.pending}
          onClick={() => void action.run(onAction, labels.actionSuccess)}
        >
          {children}
        </button>
      </IconTooltip>
      <Feedback feedback={action.feedback} />
    </div>
  );
}

export function DeleteCustomer({
  customer,
  onDelete,
  labels,
  disabled = false,
}: {
  customer: Customer;
  onDelete: (id: string) => Promise<void>;
  labels: CustomersLabels;
  disabled?: boolean;
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
        <IconTooltip label={labels.deleteCustomer}>
          <Dialog.Trigger
            className={cn(
              iconButtonClass,
              "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
            )}
            aria-label={labels.deleteCustomer}
            disabled={disabled || action.pending}
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
                disabled={disabled || action.pending}
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

export interface StatusBadgeProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  label: string;
  className: string;
  disabled?: boolean;
  onChange?: (value: T) => Promise<void>;
  errorMessage: string;
  successMessage: string;
}

export function StatusBadge<T extends string>({
  value,
  options,
  label,
  className,
  disabled,
  onChange,
  errorMessage,
  successMessage,
}: StatusBadgeProps<T>) {
  const [open, setOpen] = useState(false);
  const action = useCustomerAction(errorMessage);
  const badgeClass = cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
    className,
  );
  const text = options.find((option) => option.value === value)?.label;
  if (!onChange) return <span className={badgeClass}>{text}</span>;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (!action.pending) setOpen(next);
      }}
    >
      <DropdownMenuTrigger
        aria-label={`${label}: ${text}`}
        disabled={disabled || action.pending}
        aria-busy={action.pending}
        className={cn(
          badgeClass,
          "min-h-10 outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:min-h-8",
        )}
      >
        {text}
        <ChevronDownIcon className="size-3 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-max max-w-[calc(100vw-2rem)] min-w-48 rounded-xl"
      >
        <DropdownMenuRadioGroup
          value={value}
          aria-label={label}
          onValueChange={(next) => {
            const option = options.find((entry) => entry.value === next);
            if (!option || option.value === value || disabled || action.pending) return;
            void action
              .run(() => onChange(option.value), successMessage)
              .then((success) => {
                if (success) setOpen(false);
              });
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              closeOnClick={false}
              disabled={disabled || action.pending}
              className="min-h-10 rounded-md md:min-h-8"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <div className="min-h-5 max-w-64 px-2" aria-busy={action.pending}>
          <Feedback feedback={action.feedback} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CustomerStatusBadge({
  customer,
  labels,
  onChange,
  disabled,
}: {
  customer: Customer;
  labels: CustomersLabels;
  onChange?: (verified: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <StatusBadge
      value={customer.emailVerified ? "verified" : "unverified"}
      options={[
        { value: "verified", label: labels.verified },
        { value: "unverified", label: labels.unverified },
      ]}
      label={labels.verification(customerDisplayName(customer))}
      className={
        customer.emailVerified
          ? "bg-status-success text-status-success-foreground"
          : "bg-status-pending text-status-pending-foreground"
      }
      disabled={disabled}
      onChange={onChange ? (value) => onChange(value === "verified") : undefined}
      errorMessage={labels.actionError}
      successMessage={labels.saved}
    />
  );
}
