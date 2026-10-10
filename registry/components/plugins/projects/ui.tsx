"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { Trash2Icon } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import {
  buttonClass,
  iconButtonClass,
  cardClass,
  Feedback,
  outlineButtonClass,
  useCustomerAction,
  StatusBadge,
} from "@/components/plugins/customers/ui";
import { customerInitials } from "@/components/plugins/customers/utils";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type { Project, ProjectStatus } from "@/components/plugins/projects/types";
import { projectStatuses } from "@/components/plugins/projects/utils";
import { cn } from "@/components/utils/cn";

const popupClass = cn(
  cardClass,
  "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto shadow-xl",
);

export function ProjectAvatar({
  name,
  image,
  large = false,
}: {
  name: string;
  image?: string | null;
  large?: boolean;
}) {
  return (
    <Avatar.Root
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border text-sm",
        large && "size-16 text-xl",
      )}
    >
      <Avatar.Image src={image ?? undefined} alt={name} className="size-full object-contain" />
      <Avatar.Fallback>{customerInitials(name, "")}</Avatar.Fallback>
    </Avatar.Root>
  );
}

export function ProjectStatusBadge({
  status,
  name,
  labels,
  onChange,
  disabled,
}: {
  status: ProjectStatus;
  name: string;
  labels: ProjectsLabels;
  onChange?: (status: ProjectStatus) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <StatusBadge
      value={status}
      label={labels.changeStatus(name)}
      options={projectStatuses.map((value) => ({ value, label: labels[value] }))}
      className={
        status === "production"
          ? "bg-status-success text-status-success-foreground"
          : status === "under-construction"
            ? "bg-status-pending text-status-pending-foreground"
            : status === "prospect"
              ? "bg-status-info text-status-info-foreground"
              : "bg-status-not-started text-status-not-started-foreground"
      }
      onChange={onChange}
      disabled={disabled}
      errorMessage={labels.actionError}
      successMessage={labels.saved}
    />
  );
}

export function DeleteProject({
  project,
  onDelete,
  labels,
  disabled,
  onPendingChange,
  returnFocus,
}: {
  project: Project;
  onDelete: (id: string) => Promise<void>;
  labels: ProjectsLabels;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const action = useCustomerAction(labels.actionError);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!action.pending) setOpen(next);
        }}
      >
        <IconTooltip label={labels.deleteProject}>
          <Dialog.Trigger
            ref={trigger}
            disabled={disabled || action.pending}
            className={cn(
              iconButtonClass,
              "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
            )}
            aria-label={labels.deleteProject}
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
          </Dialog.Trigger>
        </IconTooltip>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            className={popupClass}
            finalFocus={() =>
              trigger.current?.isConnected ? trigger.current : (returnFocus?.current ?? true)
            }
          >
            <Dialog.Title className="text-lg font-semibold">{labels.deleteProject}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.deleteDescription(project.name)}
            </Dialog.Description>
            <Feedback feedback={action.feedback} />
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close disabled={action.pending} className={outlineButtonClass}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={disabled || action.pending}
                aria-busy={action.pending}
                className={cn(
                  buttonClass,
                  "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                )}
                onClick={async () => {
                  const success = await action.run(async () => {
                    onPendingChange?.(true);
                    try {
                      await onDelete(project.id);
                    } finally {
                      onPendingChange?.(false);
                    }
                  }, labels.deleted);
                  if (success) {
                    setOpen(false);
                    if (!trigger.current?.isConnected) returnFocus?.current?.focus();
                  }
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
