"use client";
import { Dialog } from "@base-ui/react/dialog";
import { PencilIcon, SendHorizontalIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  isEmployeeAdmin,
  updateEmployeeSchema,
  type Employee,
  type UpdateEmployee,
  type VerificationResult,
} from "@/components/plugins/employees/schema";
import {
  buttonClass,
  iconButtonClass,
  primaryButtonClass,
  outlineButtonClass,
  inputClass,
  dialogClass,
} from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";
export interface EmployeeActionCallbacks {
  onUpdate: (values: UpdateEmployee) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** @deprecated The employee list no longer provides an access toggle. */
  onSetBan?: (id: string, banned: boolean) => Promise<void>;
  onSendVerification: (id: string) => Promise<VerificationResult>;
}
export interface EmployeeActionsProps extends EmployeeActionCallbacks {
  employee: Employee;
  currentUserId: string;
  labels?: Partial<EmployeeLabels>;
  className?: string;
}
export function EmployeeActions({
  employee,
  currentUserId,
  onUpdate,
  onDelete,
  onSendVerification,
  labels: overrides,
  className,
}: EmployeeActionsProps) {
  const labels = { ...employeeLabels, ...overrides };
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [failedAction, setFailedAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const isSelf = employee.id === currentUserId;
  async function run(kind: "edit" | "remove" | "send", action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFailedAction(null);
    setFeedback(null);
    try {
      await action();
    } catch {
      setFailedAction(kind);
      if (kind === "send")
        setFeedback({
          error: true,
          message: labels.emailError,
        });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className="flex items-center justify-end gap-1">
        {!employee.emailVerified && (
          <button
            type="button"
            className={iconButtonClass}

            disabled={pending}
            aria-label={`${labels.sendEmail} ${employee.name}`}
            onClick={() =>
              void run("send", async () => {
                const { status } = await onSendVerification(employee.id);
                setFeedback({
                  error: status === "unavailable",
                  message:
                    status === "unavailable"
                      ? labels.emailUnavailable
                      : status === "verified"
                        ? labels.verified
                        : labels.emailSent,
                });
              })
            }
          >
            <SendHorizontalIcon aria-hidden="true" />
          </button>
        )}
        <Dialog.Root
          open={editing}
          onOpenChange={(open) => {
            if (!pending) {
              setFailedAction(null);
              setEditing(open);
            }
          }}
        >
          <Dialog.Trigger
            disabled={pending}
            className={iconButtonClass}

            aria-label={`${labels.edit} ${employee.name}`}
          >
            <PencilIcon aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
            <Dialog.Popup className={dialogClass}>
              <div className="space-y-2">
                <Dialog.Title className="text-lg font-semibold">{labels.editTitle}</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {labels.editDescription}
                </Dialog.Description>
              </div>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void run("edit", async () => {
                    await onUpdate(
                      updateEmployeeSchema.parse({
                        ...Object.fromEntries(data),
                        id: employee.id,
                        role: isSelf ? "admin" : data.get("role"),
                      }),
                    );
                    setEditing(false);
                  });
                }}
              >
                <div className="grid gap-2">
                  <label htmlFor={`name-${employee.id}`}>{labels.name}</label>
                  <input
                    className={inputClass}
                    id={`name-${employee.id}`}
                    name="name"
                    defaultValue={employee.name}
                    maxLength={200}
                    required
                    readOnly={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor={`email-${employee.id}`}>{labels.email}</label>
                  <input
                    className={inputClass}
                    id={`email-${employee.id}`}
                    name="email"
                    type="email"
                    defaultValue={employee.email}
                    required
                    readOnly={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor={`role-${employee.id}`}>{labels.role}</label>
                  <select
                    id={`role-${employee.id}`}
                    name="role"
                    defaultValue={isEmployeeAdmin(employee.role) ? "admin" : "user"}
                    disabled={pending || isSelf}
                    className="h-9 rounded-lg border bg-background px-3 text-sm"
                  >
                    <option value="user">{labels.roleUser}</option>
                    <option value="admin">{labels.roleAdmin}</option>
                  </select>
                </div>
                {failedAction === "edit" && (
                  <p role="alert" className="text-destructive">
                    {labels.editError}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className={outlineButtonClass}
                    disabled={pending}
                    onClick={() => setEditing(false)}
                  >
                    {labels.cancel}
                  </button>
                  <button type="submit" className={primaryButtonClass} disabled={pending}>
                    {pending ? labels.saving : labels.saveChanges}
                  </button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        {!isSelf && (
          <Dialog.Root
            open={deleting}
            onOpenChange={(open) => {
              if (!pending) {
                setFailedAction(null);
                setDeleting(open);
              }
            }}
          >
            <Dialog.Trigger
              disabled={pending}
              className={cn(iconButtonClass, "text-destructive hover:text-destructive")}
              aria-label={`${labels.delete} ${employee.name}`}
            >
              <Trash2Icon aria-hidden="true" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
              <Dialog.Popup className={dialogClass}>
                <div className="space-y-2">
                  <Dialog.Title className="text-lg font-semibold">
                    {labels.deleteTitle}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {labels.deleteDescription.replace("{name}", employee.name)}
                  </Dialog.Description>
                </div>
                {failedAction === "remove" && (
                  <p role="alert" className="text-destructive">
                    {labels.deleteError}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className={outlineButtonClass}
                    disabled={pending}
                    onClick={() => setDeleting(false)}
                  >
                    {labels.cancel}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      buttonClass,
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    )}
                    disabled={pending}
                    onClick={() =>
                      void run("remove", async () => {
                        await onDelete(employee.id);
                        setDeleting(false);
                      })
                    }
                  >
                    {pending ? labels.deleting : labels.delete}
                  </button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={cn(
            "max-w-60 text-xs whitespace-normal",
            feedback.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
