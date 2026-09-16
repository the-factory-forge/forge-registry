"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { CheckIcon, ChevronDownIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import {
  buttonClass,
  cardClass,
  Feedback,
  inputClass,
  useCustomerAction,
} from "@/components/plugins/customers/ui";
import { customerInitials } from "@/components/plugins/customers/utils";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type { Project, ProjectAssignee, ProjectStatus } from "@/components/plugins/projects/types";
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
  labels,
}: {
  status: ProjectStatus;
  labels: ProjectsLabels;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold",
        status === "production"
          ? "bg-primary text-primary-foreground"
          : status === "under-construction"
            ? "bg-accent text-accent-foreground"
            : status === "prospect"
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground",
      )}
    >
      {labels[status]}
    </span>
  );
}

export interface ProjectPersonPickerProps {
  id: string;
  name: string;
  candidates: readonly ProjectAssignee[];
  value: string;
  onChange: (id: string) => void;
  title: string;
  searchLabel: string;
  unavailableLabel: string;
  labels: ProjectsLabels;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  clearable?: boolean;
}

export function ProjectPersonPicker({
  id,
  name,
  candidates,
  value,
  onChange,
  title,
  searchLabel,
  unavailableLabel,
  labels,
  disabled,
  required,
  error,
  clearable,
}: ProjectPersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = candidates.find((candidate) => candidate.id === value);
  const query = search.trim().toLowerCase();
  const filtered = candidates.filter((candidate) =>
    [candidate.name, candidate.email].some((text) => text?.toLowerCase().includes(query)),
  );
  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <Dialog.Trigger
        id={id}
        name={name}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-label={`${title}${required ? " *" : ""}`}
        className={cn(
          buttonClass,
          "min-h-14 w-full min-w-0 justify-start border border-border px-3 text-left aria-invalid:ring-2 aria-invalid:ring-red-600",
        )}
      >
        <ProjectAvatar name={selected?.name ?? ""} image={selected?.image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {selected?.name ?? (value ? unavailableLabel : title)}
          </span>
          {selected?.email && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {selected.email}
            </span>
          )}
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className={popupClass}>
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.pickerDescription}
          </Dialog.Description>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="absolute top-2 left-3 size-4 text-muted-foreground"
            />
            <input
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(inputClass, "pl-9")}
            />
          </div>
          <div className="max-h-[min(24rem,45dvh)] space-y-2 overflow-y-auto p-1">
            {clearable && (
              <button
                type="button"
                className={cn(buttonClass, "w-full justify-start border border-border")}
                aria-pressed={!value}
                onClick={() => select("")}
              >
                {labels.clearAssignee}
              </button>
            )}
            {filtered.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={cn(
                  buttonClass,
                  "w-full min-w-0 justify-start rounded-xl border border-border py-2 text-left",
                  candidate.id === value && "bg-accent text-accent-foreground",
                )}
                aria-pressed={candidate.id === value}
                onClick={() => select(candidate.id)}
              >
                <ProjectAvatar name={candidate.name} image={candidate.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{candidate.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {candidate.email}
                  </span>
                </span>
                {candidate.id === value && <CheckIcon aria-hidden="true" />}
              </button>
            ))}
            {!filtered.length && (
              <output className="py-4 text-center text-sm text-muted-foreground">
                {labels.noMatches}
              </output>
            )}
          </div>
          <div className="flex justify-end">
            <Dialog.Close className={buttonClass}>{labels.close}</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
        <Dialog.Trigger
          ref={trigger}
          disabled={disabled || action.pending}
          className={cn(buttonClass, "text-red-600 dark:text-red-400")}
          aria-label={labels.deleteProject}
        >
          <Trash2Icon aria-hidden="true" />
          <span>{labels.deleteProject}</span>
        </Dialog.Trigger>
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
            <div className="flex justify-end gap-2">
              <Dialog.Close disabled={action.pending} className={buttonClass}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={action.pending}
                aria-busy={action.pending}
                className={cn(buttonClass, "bg-red-600 text-white hover:bg-red-700")}
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
