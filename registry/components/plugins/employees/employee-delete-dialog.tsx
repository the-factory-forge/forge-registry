"use client";

import { Dialog } from "@base-ui/react/dialog";
import { RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import { NativeSelect } from "@/components/native-select";
import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  buttonClass,
  iconButtonClass,
  outlineButtonClass,
  dialogClass,
  inputClass,
} from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";

export interface EmployeeDeletionGroup {
  /** Unique across the preview, including when several employees are selected. */
  id: string;
  label: string;
  items: { id: string; title: string; href?: string; status?: string }[];
  choices: { id: string; label: string; description?: string; requiresReplacement?: boolean }[];
  replacements?: { id: string; name: string }[];
}
export interface EmployeeDeletionPreview {
  /** Opaque host-issued version/fingerprint, revalidated at confirmation. */
  token: string;
  groups: EmployeeDeletionGroup[];
}
export type EmployeeDeletionDecisions = Record<string, { choice: string; replacementId?: string }>;
export interface EmployeeDeletionAdapter {
  preview: (employeeIds: string[]) => Promise<EmployeeDeletionPreview>;
  /** Atomically validate the preview, process all groups and remove the accounts. */
  confirm: (
    employeeIds: string[],
    token: string,
    decisions: EmployeeDeletionDecisions,
  ) => Promise<void>;
}
export interface EmployeeDeleteDialogProps {
  employees: readonly { id: string; name: string }[];
  adapter: EmployeeDeletionAdapter;
  labels?: Partial<EmployeeLabels>;
  disabled?: boolean;
  bulk?: boolean;
  className?: string;
}
export function EmployeeDeleteDialog({
  employees,
  adapter,
  labels: overrides,
  disabled,
  bulk = false,
  className,
}: EmployeeDeleteDialogProps) {
  const labels = { ...employeeLabels, ...overrides };
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EmployeeDeletionPreview | null>(null);
  const [targets, setTargets] = useState<typeof employees>([]);
  const [decisions, setDecisions] = useState<EmployeeDeletionDecisions>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "saving">("idle");
  const generation = useRef(0);
  useLoadingActivity(open && status === "loading");
  const saving = useRef(false);
  async function load(selected = targets) {
    const request = ++generation.current;
    setPreview(null);
    setDecisions({});
    setStatus("loading");
    try {
      const result = await adapter.preview(selected.map((employee) => employee.id));
      if (request === generation.current) {
        setPreview(result);
        setStatus("idle");
      }
    } catch {
      if (request === generation.current) setStatus("error");
    }
  }
  const ready =
    preview &&
    preview.groups.every((group) => {
      const decision = decisions[group.id];
      const choice = group.choices.find((item) => item.id === decision?.choice);
      return (
        choice &&
        (!choice.requiresReplacement ||
          group.replacements?.some((person) => person.id === decision.replacementId))
      );
    });
  const pending = status === "loading" || status === "saving";
  const actionLabel =
    !bulk && employees.length === 1
      ? `${labels.delete} ${employees[0].name}`
      : labels.deleteSelected;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (saving.current) return;
        setOpen(next);
        if (next) {
          setTargets([...employees]);
          void load(employees);
        } else {
          generation.current++;
          setPreview(null);
        }
      }}
    >
      <IconTooltip label={actionLabel}>
        <Dialog.Trigger
          aria-label={actionLabel}
          disabled={disabled || !employees.length}
          className={cn(
            iconButtonClass,
            "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
            className,
          )}
        >
          <Trash2Icon className="size-4" aria-hidden="true" />
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className={cn(dialogClass, "max-h-[90dvh] overflow-y-auto")}>
          <Dialog.Title className="text-lg font-semibold">{labels.deleteTitle}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.deleteDescription.replace(
              "{name}",
              targets.map((employee) => employee.name).join(", "),
            )}
          </Dialog.Description>
          {status === "loading" && <output>{labels.loadingRelatedData}</output>}
          {status === "error" && (
            <p role="alert" className="text-destructive">
              {labels.deleteError}
            </p>
          )}
          {preview?.groups.map((group) => (
            <fieldset
              key={group.id}
              disabled={pending}
              className="grid gap-3 border-t border-border pt-4"
            >
              <legend className="font-semibold">{group.label}</legend>
              <details>
                <summary className="cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-ring">
                  {labels.relatedItems} ({group.items.length})
                </summary>
                <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-sm">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                      {item.status && (
                        <span className="ml-2 text-muted-foreground">{item.status}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
              {group.choices.map((choice) => (
                <label key={choice.id} className="flex gap-2 text-sm">
                  <input
                    type="radio"
                    name={`factory-delete-${group.id}`}
                    value={choice.id}
                    checked={decisions[group.id]?.choice === choice.id}
                    onChange={() =>
                      setDecisions({ ...decisions, [group.id]: { choice: choice.id } })
                    }
                  />
                  <span>
                    {choice.label}
                    {choice.description && (
                      <span className="mt-1 block text-muted-foreground">{choice.description}</span>
                    )}
                  </span>
                </label>
              ))}
              {group.choices.find((choice) => choice.id === decisions[group.id]?.choice)
                ?.requiresReplacement && (
                <label className="grid gap-2 text-sm">
                  {labels.replacement}
                  <NativeSelect
                    aria-label={labels.replacement}
                    className={inputClass}
                    value={decisions[group.id]?.replacementId ?? ""}
                    onChange={(event) =>
                      setDecisions({
                        ...decisions,
                        [group.id]: { ...decisions[group.id], replacementId: event.target.value },
                      })
                    }
                  >
                    <option value="">{labels.chooseReplacement}</option>
                    {group.replacements?.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </fieldset>
          ))}
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Close className={outlineButtonClass} disabled={status === "saving"}>
              {labels.cancel}
            </Dialog.Close>
            {status === "error" && (
              <button type="button" className={outlineButtonClass} onClick={() => void load()}>
                <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.reloadRelatedData}
              </button>
            )}
            <button
              type="button"
              className={cn(buttonClass, "bg-destructive/10 text-destructive")}
              disabled={pending || !ready || status === "error"}
              onClick={async () => {
                if (saving.current || !preview || !ready) return;
                saving.current = true;
                setStatus("saving");
                try {
                  await adapter.confirm(
                    targets.map((employee) => employee.id),
                    preview.token,
                    decisions,
                  );
                  setOpen(false);
                  setPreview(null);
                  setStatus("idle");
                } catch {
                  setStatus("error");
                } finally {
                  saving.current = false;
                }
              }}
            >
              {status === "saving" ? labels.deleting : labels.delete}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
