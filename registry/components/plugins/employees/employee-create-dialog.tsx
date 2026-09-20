"use client";
import { Dialog } from "@base-ui/react/dialog";
import { PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  createEmployeeSchema,
  isEmployeeAdmin,
  type CreateEmployee,
} from "@/components/plugins/employees/schema";
import {
  dialogClass,
  inputClass,
  outlineButtonClass,
  primaryButtonClass,
} from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";

export interface EmployeeCreateDialogProps {
  /** Role from the host's authenticated session. Missing or non-admin roles render nothing. */
  currentUserRole: string | null | undefined;
  onCreate: (values: CreateEmployee) => Promise<void>;
  labels?: Partial<EmployeeLabels>;
  className?: string;
}

export function EmployeeCreateDialog({
  currentUserRole,
  onCreate,
  labels: overrides,
  className,
}: EmployeeCreateDialogProps) {
  const labels = { ...employeeLabels, ...overrides };
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  if (!isEmployeeAdmin(currentUserRole)) return null;

  async function submit(form: HTMLFormElement) {
    if (lock.current) return;
    const data = new FormData(form);
    lock.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onCreate(createEmployeeSchema.parse(Object.fromEntries(data)));
      form.reset();
      setOpen(false);
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
        setOpen(next);
      }}
    >
      <Dialog.Trigger className={cn(primaryButtonClass, className)}>
        <PlusIcon aria-hidden="true" />
        {labels.add}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className={dialogClass}>
          <div className="space-y-2">
            <Dialog.Title className="text-lg font-semibold">{labels.add}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.instructions}
            </Dialog.Description>
          </div>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(event.currentTarget);
            }}
          >
            <div className="grid gap-2">
              <label htmlFor={`${id}-name`}>{labels.name}</label>
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
              <label htmlFor={`${id}-email`}>{labels.email}</label>
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
              <label htmlFor={`${id}-password`}>{labels.password}</label>
              <input
                className={inputClass}
                id={`${id}-password`}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                readOnly={pending}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor={`${id}-role`}>{labels.role}</label>
              <select
                id={`${id}-role`}
                name="role"
                defaultValue="user"
                disabled={pending}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="user">{labels.roleUser}</option>
                <option value="admin">{labels.roleAdmin}</option>
              </select>
            </div>
            {failed && (
              <p role="alert" className="text-destructive">
                {labels.createError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Dialog.Close type="button" className={outlineButtonClass} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button className={primaryButtonClass} type="submit" disabled={pending}>
                {pending ? labels.adding : labels.save}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
