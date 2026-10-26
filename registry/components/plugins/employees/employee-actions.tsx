"use client";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon, PencilIcon, SendHorizontalIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { useActionToast, ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { NativeSelect } from "@/components/native-select";
import {
  EmployeeDeleteDialog,
  type EmployeeDeletionAdapter,
} from "@/components/plugins/employees/employee-delete-dialog";
import {
  EmployeePhotoField,
  type EmployeePhotoFieldProps,
} from "@/components/plugins/employees/employee-photo-field";
import { EmployeeWebsiteStatus } from "@/components/plugins/employees/employee-website-status";
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
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";
import { tableActionsClass } from "@/components/utils/table-styles";
import { useMutationAction } from "@/components/utils/use-optimistic-action";
export interface EmployeeActionCallbacks {
  deletion?: EmployeeDeletionAdapter;
  onUploadPhoto?: (id: string, file: File) => Promise<void>;
  photoOptions?: Pick<EmployeePhotoFieldProps, "dimensions" | "labels" | "cropLabels">;
  onUpdate: (values: UpdateEmployee) => Promise<void>;
  /** Persist public-profile visibility and refresh the host's employee data. */
  onSetWebsitePublished?: (id: string, published: boolean) => Promise<void>;
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
  disabled?: boolean;
}
function EmployeeActionsContent({
  employee,
  currentUserId,
  onUpdate,
  onSetWebsitePublished,
  onDelete,
  deletion,
  onUploadPhoto,
  photoOptions,
  onSendVerification,
  labels: overrides,
  className,
  disabled = false,
}: EmployeeActionsProps) {
  const labels = { ...employeeLabels, ...overrides };
  const id = `factory-employee-edit-${useId()}`;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutation = useMutationAction(`${currentUserId}:${employee.id}`);
  const pending = mutation.pending;
  const [actionKind, setFailedAction] = useState<string | null>(null);
  const failedAction = mutation.error ? actionKind : null;
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const notify = useActionToast();
  const isSelf = employee.id === currentUserId;
  const emailAction = employee.mustChangePassword ? labels.sendInvitation : labels.sendEmail;
  function run<T>(
    kind: "edit" | "remove" | "send" | "website",
    action: () => Promise<T>,
    accept?: (result: T) => void,
  ) {
    if (disabled || pending) return;
    setFailedAction(kind);
    setFeedback(null);
    return mutation.run(action, accept);
  }
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className={tableActionsClass}>
        <IconTooltip label={`${emailAction} ${employee.name}`}>
          <button
            type="button"
            className={iconButtonClass}

            disabled={
              disabled ||
              pending ||
              employee.banned ||
              (!employee.mustChangePassword && employee.emailVerified)
            }
            aria-label={`${emailAction} ${employee.name}`}
            onClick={() =>
              void run(
                "send",
                () => onSendVerification(employee.id),
                ({ status }) => {
                  if (status === "unavailable") {
                    setFeedback({ error: true, message: labels.emailUnavailable });
                  } else {
                    notify(
                      status === "verified"
                        ? labels.verified
                        : employee.mustChangePassword
                          ? labels.invitationSent
                          : labels.emailSent,
                    );
                  }
                },
              )
            }
          >
            <SendHorizontalIcon aria-hidden="true" />
          </button>
        </IconTooltip>
        <Dialog.Root
          open={editing}
          onOpenChange={(open) => {
            if (!pending) {
              setFailedAction(null);
              setEditing(open);
            }
          }}
        >
          <IconTooltip label={`${labels.edit} ${employee.name}`}>
            <Dialog.Trigger
              disabled={disabled || pending}
              className={iconButtonClass}

              aria-label={`${labels.edit} ${employee.name}`}
            >
              <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
            </Dialog.Trigger>
          </IconTooltip>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
            <Dialog.Popup
              className={cn(dialogClass, "max-h-[90dvh]")}
              onKeyDownCapture={submitDialogOnShortcut}
            >
              <div
                data-dialog-header
                className="sticky top-0 z-20 -mx-6 space-y-2 bg-background px-6 pt-5 pb-0"
              >
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                    <Dialog.Title className="text-lg font-semibold">
                      {labels.editTitle}
                    </Dialog.Title>
                    {employee.websitePublished !== undefined &&
                      (onSetWebsitePublished ? (
                        <button
                          type="button"
                          aria-label={labels.website}
                          aria-pressed={employee.websitePublished}
                          disabled={disabled || pending}
                          className="ml-auto inline-flex min-h-10 cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8"
                          onClick={() =>
                            void run(
                              "website",
                              () => onSetWebsitePublished(employee.id, !employee.websitePublished),
                              () => notify(labels.websiteUpdated),
                            )
                          }
                        >
                          <EmployeeWebsiteStatus
                            published={employee.websitePublished}
                            labels={labels}
                          />
                        </button>
                      ) : (
                        <EmployeeWebsiteStatus
                          published={employee.websitePublished}
                          labels={labels}
                          className="ml-auto"
                        />
                      ))}
                  </div>
                  <IconTooltip label={labels.close}>
                    <Dialog.Close
                      type="button"
                      aria-label={labels.close}
                      disabled={pending}
                      className={iconButtonClass}
                    >
                      <XIcon className="size-4 shrink-0" aria-hidden="true" />
                    </Dialog.Close>
                  </IconTooltip>
                </div>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {labels.editDescription}
                </Dialog.Description>
                {failedAction === "website" && (
                  <p role="alert" className="text-sm text-destructive">
                    {labels.websiteError}
                  </p>
                )}
              </div>
              <form
                className="contents space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void run(
                    "edit",
                    async () => {
                      await onUpdate(
                        updateEmployeeSchema.parse({
                          ...Object.fromEntries(data),
                          id: employee.id,
                          role: isSelf ? "admin" : data.get("role"),
                        }),
                      );
                    },
                    () => {
                      notify(labels.updated);
                      setEditing(false);
                    },
                  );
                }}
              >
                {onUploadPhoto && (
                  <EmployeePhotoField
                    {...photoOptions}
                    src={employee.image}
                    disabled={disabled || pending}
                    onUpload={(file) => onUploadPhoto(employee.id, file)}
                  />
                )}
                <div className="grid gap-2">
                  <label htmlFor={`${id}-name`}>
                    {labels.name} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    className={inputClass}
                    id={`${id}-name`}
                    name="name"
                    defaultValue={employee.name}
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
                    defaultValue={employee.email}
                    required
                    readOnly={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor={`${id}-role`}>{labels.role}</label>
                  <NativeSelect
                    id={`${id}-role`}
                    name="role"
                    defaultValue={isEmployeeAdmin(employee.role) ? "admin" : "user"}
                    disabled={pending || isSelf}
                    className={inputClass}
                  >
                    <option value="user">{labels.roleUser}</option>
                    <option value="admin">{labels.roleAdmin}</option>
                  </NativeSelect>
                </div>
                {failedAction === "edit" && (
                  <p role="alert" className="text-destructive">
                    {labels.editError}
                  </p>
                )}
                <div
                  data-dialog-footer
                  className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-3 bg-background px-6 pt-0 pb-5"
                >
                  <button
                    type="button"
                    className={outlineButtonClass}
                    disabled={pending}
                    onClick={() => setEditing(false)}
                  >
                    {labels.cancel}
                  </button>
                  <button
                    type="submit"
                    className={primaryButtonClass}
                    disabled={disabled || pending}
                  >
                    {pending ? labels.saving : labels.saveChanges}
                  </button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        {deletion ? (
          <EmployeeDeleteDialog
            employees={[employee]}
            adapter={deletion}
            labels={labels}
            disabled={disabled || pending || isSelf}
          />
        ) : (
          <Dialog.Root
            open={deleting}
            onOpenChange={(open) => {
              if (!pending) {
                setFailedAction(null);
                setDeleting(open);
              }
            }}
          >
            <IconTooltip label={`${labels.delete} ${employee.name}`}>
              <Dialog.Trigger
                disabled={disabled || pending || isSelf}
                className={cn(
                  iconButtonClass,
                  "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                )}
                aria-label={`${labels.delete} ${employee.name}`}
              >
                <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Trigger>
            </IconTooltip>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
              <Dialog.Popup className={dialogClass}>
                <div
                  data-dialog-header
                  className="sticky top-0 z-20 -mx-6 space-y-2 bg-background px-6 pt-5 pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
                      {labels.deleteTitle}
                    </Dialog.Title>
                    <IconTooltip label={labels.close}>
                      <Dialog.Close
                        type="button"
                        aria-label={labels.close}
                        disabled={pending}
                        className={iconButtonClass}
                      >
                        <XIcon className="size-4 shrink-0" aria-hidden="true" />
                      </Dialog.Close>
                    </IconTooltip>
                  </div>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {labels.deleteDescription.replace("{name}", employee.name)}
                  </Dialog.Description>
                </div>
                {failedAction === "remove" && (
                  <p role="alert" className="text-destructive">
                    {labels.deleteError}
                  </p>
                )}
                <div
                  data-dialog-footer
                  className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-3 bg-background px-6 pt-0 pb-5"
                >
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
                      "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                    )}
                    disabled={disabled || pending || isSelf}
                    onClick={() =>
                      void run(
                        "remove",
                        () => onDelete(employee.id),
                        () => setDeleting(false),
                      )
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
      {failedAction === "send" && (
        <p role="alert" className="text-xs text-destructive">
          {labels.emailError}
        </p>
      )}
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

export function EmployeeActions(props: EmployeeActionsProps) {
  return (
    <ActionToastProvider>
      <EmployeeActionsContent key={`${props.currentUserId}:${props.employee.id}`} {...props} />
    </ActionToastProvider>
  );
}
