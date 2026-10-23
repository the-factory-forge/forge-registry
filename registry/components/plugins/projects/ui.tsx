"use client";

import { Avatar } from "@base-ui/react/avatar";
import type { RefObject } from "react";

import { StatusBadge } from "@/components/plugins/customers/ui";
import { customerInitials } from "@/components/plugins/customers/utils";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type { Project, ProjectStatus } from "@/components/plugins/projects/types";
import { projectStatuses } from "@/components/plugins/projects/utils";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { cn } from "@/components/utils/cn";

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
  const deletion = useRecordDeletion({
    items: [project],
    scope: project.id,
    getName: (item) => item.name,
    onDelete,
    label: labels.deleteProject,
    labels,
    disabled,
    returnFocus,
    onPendingChange,
  });
  return (
    <>
      <RecordDeleteButton
        label={labels.deleteProject}
        disabled={disabled || deletion.pending}
        onClick={(event) => deletion.open(project.id, event.currentTarget)}
      />
      {deletion.dialog}
    </>
  );
}
