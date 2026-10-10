"use client";

import { useId, useState, type FormEvent } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { NativeSelect } from "@/components/native-select";
import {
  cardClass,
  Feedback,
  inputClass,
  primaryButtonClass,
  useCustomerAction,
} from "@/components/plugins/customers/ui";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type { Project, ProjectFormValues } from "@/components/plugins/projects/types";
import { DeleteProject } from "@/components/plugins/projects/ui";
import {
  projectFormValues,
  projectStatuses,
  validateProject,
} from "@/components/plugins/projects/utils";
import { cn } from "@/components/utils/cn";
import { editorActionsClass, useEditorValidation } from "@/components/utils/editor-form";

export interface ProjectFormProps {
  className?: string;
  disabled?: boolean;
  statusUpdate?: { status: ProjectFormValues["status"] };
  project?: Project;
  labels: ProjectsLabels;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function ProjectFormContent({
  project,
  labels,
  onSubmit,
  onDelete,
  className,
  disabled,
  statusUpdate,
}: ProjectFormProps) {
  const id = `factory-project-form-${useId()}`;
  const [values, setValues] = useState(() => projectFormValues(project));
  const { formRef, issues: errors, setIssues: setErrors, clear } = useEditorValidation();
  const [deleting, setDeleting] = useState(false);
  const action = useCustomerAction(labels.actionError);
  const pending = disabled || action.pending || deleting;
  const [previousStatusUpdate, setPreviousStatusUpdate] = useState(statusUpdate);
  if (statusUpdate !== previousStatusUpdate) {
    setPreviousStatusUpdate(statusUpdate);
    if (statusUpdate) setValues((current) => ({ ...current, status: statusUpdate.status }));
  }

  function change<K extends keyof ProjectFormValues>(name: K, value: ProjectFormValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
    clear(name);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const normalized = {
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
    };
    const nextErrors = validateProject(normalized, labels);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (await action.run(() => onSubmit(normalized), project ? labels.saved : labels.created))
      setValues(normalized);
  }
  function error(name: keyof ProjectFormValues) {
    return errors[name] ? (
      <p id={`${id}-${name}-error`} role="alert" className="text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null;
  }
  function fieldProps(name: keyof ProjectFormValues) {
    return {
      id: `${id}-${name}`,
      name,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
      className: inputClass,
    };
  }
  return (
    <div className={className}>
      <form
        ref={formRef}
        tabIndex={-1}
        noValidate
        onSubmit={submit}
        aria-busy={pending}
        className={cn(cardClass, "space-y-5")}
      >
        {project && (
          <div className="space-y-1.5">
            <h2 className="font-semibold">{labels.detailsTitle}</h2>
            <p className="text-sm text-muted-foreground">{labels.detailsDescription}</p>
          </div>
        )}
        <fieldset disabled={pending} className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={`${id}-name`} className="block text-sm font-semibold">
              {labels.name} *
            </label>
            <input
              {...fieldProps("name")}
              required
              value={values.name}
              onChange={(event) => change("name", event.target.value)}
            />
            {error("name")}
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-status`} className="block text-sm font-semibold">
              {labels.status}
            </label>
            <NativeSelect
              {...fieldProps("status")}
              value={values.status}
              onChange={(event) => {
                const status = projectStatuses.find((entry) => entry === event.target.value);
                if (status) change("status", status);
              }}
            >
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {labels[status]}
                </option>
              ))}
            </NativeSelect>
            {error("status")}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor={`${id}-description`} className="block text-sm font-semibold">
              {labels.projectDescription}
            </label>
            <textarea
              {...fieldProps("description")}
              className={cn(inputClass, "h-auto py-2")}
              rows={3}
              value={values.description}
              onChange={(event) => change("description", event.target.value)}
            />
            {error("description")}
          </div>
        </fieldset>
        <Feedback feedback={action.feedback} />
        <div className={editorActionsClass}>
          {project && onDelete && (
            <div>
              <DeleteProject
                project={project}
                onDelete={onDelete}
                labels={labels}
                disabled={pending}
                onPendingChange={setDeleting}
                returnFocus={formRef}
              />
            </div>
          )}
          <button type="submit" disabled={pending} className={cn(primaryButtonClass, "ml-auto")}>
            {pending ? labels.pending : project ? labels.save : labels.create}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ProjectForm(props: ProjectFormProps) {
  return (
    <ActionToastProvider>
      <ProjectFormContent {...props} />
    </ActionToastProvider>
  );
}
