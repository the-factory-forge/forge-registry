"use client";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon, PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { NativeSelect } from "@/components/native-select";
import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  createEmployeeSchema,
  isEmployeeAdmin,
  type CreateEmployee,
  type InvitationResult,
} from "@/components/plugins/employees/schema";
import {
  dialogClass,
  inputClass,
  outlineButtonClass,
  primaryButtonClass,
} from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";

export interface EmployeeCreateDialogProps {
  /** Role from the host's authenticated session. Missing or non-admin roles render nothing. */
  currentUserRole: string | null | undefined;
  onCreate: (values: CreateEmployee) => Promise<InvitationResult>;
  labels?: Partial<EmployeeLabels>;
  className?: string;
  disabled?: boolean;
}

export function EmployeeCreateDialog({
  currentUserRole,
  onCreate,
  labels: overrides,
  className,
  disabled = false,
}: EmployeeCreateDialogProps) {
  const labels = { ...employeeLabels, ...overrides };
  const id = `factory-employee-create-${useId()}`;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const lock = useRef(false);
  if (!isEmployeeAdmin(currentUserRole)) return null;

  async function submit(form: HTMLFormElement) {
    if (lock.current) return;
    const data = new FormData(form);
    lock.current = true;
    setPending(true);
    setFailed(false);
    try {
      const result = await onCreate(createEmployeeSchema.parse(Object.fromEntries(data)));
      form.reset();
      setDeliveryFailed(!result.invitationSent);
      if (result.invitationSent) setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setFailed(false);
        setDeliveryFailed(false);
        setOpen(next);
      }}
    >
      <Dialog.Trigger className={cn(primaryButtonClass, className)} disabled={disabled}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.add}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className={dialogClass} onKeyDownCapture={submitDialogOnShortcut}>
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 space-y-2 bg-background px-6 pt-5 pb-0"
          >
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
                {labels.add}
              </Dialog.Title>
              <IconTooltip label={labels.close}>
                <Dialog.Close
                  type="button"
                  aria-label={labels.close}
                  disabled={pending}
                  className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:size-8"
                >
                  <XIcon className="size-4 shrink-0" aria-hidden="true" />
                </Dialog.Close>
              </IconTooltip>
            </div>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.instructions}
            </Dialog.Description>
          </div>
          {deliveryFailed ? (
            <div className="contents space-y-4">
              <p role="alert">{labels.invitationFailed}</p>
              <div
                data-dialog-footer
                className="sticky bottom-0 z-10 -mx-6 flex justify-end bg-background px-6 pt-0 pb-5"
              >
                <Dialog.Close className={outlineButtonClass}>{labels.close}</Dialog.Close>
              </div>
            </div>
          ) : (
            <form
              className="contents space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
            >
              <div className="grid gap-2">
                <label htmlFor={`${id}-name`}>
                  {labels.name} <span aria-hidden="true">*</span>
                </label>
                <input
                  className={inputClass}
                  id={`${id}-name`}
                  name="name"
                  autoComplete="name"
                  maxLength={200}
                  required
                  readOnly={pending}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-email`}>
                  {labels.email} <span aria-hidden="true">*</span>
                </label>
                <input
                  className={inputClass}
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  readOnly={pending}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-role`}>{labels.role}</label>
                <NativeSelect
                  id={`${id}-role`}
                  name="role"
                  defaultValue="user"
                  disabled={pending}
                  className={inputClass}
                >
                  <option value="user">{labels.roleUser}</option>
                  <option value="admin">{labels.roleAdmin}</option>
                </NativeSelect>
              </div>
              {failed && (
                <p role="alert" className="text-destructive">
                  {labels.createError}
                </p>
              )}
              <div
                data-dialog-footer
                className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-3 bg-background px-6 pt-0 pb-5"
              >
                <Dialog.Close type="button" className={outlineButtonClass} disabled={pending}>
                  {labels.cancel}
                </Dialog.Close>
                <button className={primaryButtonClass} type="submit" disabled={pending}>
                  {pending ? labels.adding : labels.save}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
