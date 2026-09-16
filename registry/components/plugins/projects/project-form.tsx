"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { Link } from "@/components/link";
import {
  cardClass,
  Feedback,
  inputClass,
  primaryButtonClass,
  useCustomerAction,
} from "@/components/plugins/customers/ui";
import { customerDisplayName } from "@/components/plugins/customers/utils";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type {
  Project,
  ProjectDirectoryProps,
  ProjectFormValues,
  ProjectsAppearanceProps,
} from "@/components/plugins/projects/types";
import { DeleteProject, ProjectPersonPicker } from "@/components/plugins/projects/ui";
import {
  projectFormValues,
  projectStatuses,
  validateProject,
} from "@/components/plugins/projects/utils";
import { cn } from "@/components/utils/cn";

export interface ProjectFormProps
  extends ProjectDirectoryProps, Omit<ProjectsAppearanceProps, "labels"> {
  project?: Project;
  labels: ProjectsLabels;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ProjectForm({
  project,
  labels,
  onSubmit,
  onDelete,
  customers,
  customersLoading,
  customersError,
  createCustomerHref,
  assignees = [],
  assigneesLoading,
  assigneesError,
  defaultOwnerId,
  lockOwner,
  linkComponent: ProjectLink = Link,
  className,
}: ProjectFormProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => projectFormValues(project, defaultOwnerId));
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormValues, string>>>({});
  const [deleting, setDeleting] = useState(false);
  const action = useCustomerAction(labels.actionError);
  const pending = action.pending || deleting;
  const ownerId = lockOwner ? (project?.ownerId ?? defaultOwnerId ?? "") : values.ownerId;
  const directoriesUnavailable = Boolean(
    customersLoading || customersError || assigneesLoading || assigneesError,
  );
  const noCustomers = !customersLoading && !customersError && !customers.length;

  function change<K extends keyof ProjectFormValues>(name: K, value: ProjectFormValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || directoriesUnavailable) return;
    const normalized = {
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      url: values.url.trim(),
      ownerId,
    };
    const nextErrors = validateProject(normalized, customers, assignees, labels);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      (event.currentTarget.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      return;
    }
    if (await action.run(() => onSubmit(normalized), project ? labels.saved : labels.created))
      setValues(normalized);
  }
  function error(name: keyof ProjectFormValues) {
    return errors[name] ? (
      <p id={`${id}-${name}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
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
            <select
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
            </select>
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
          <div className="space-y-2 md:col-span-2">
            <label htmlFor={`${id}-url`} className="block text-sm font-semibold">
              {labels.url}
            </label>
            <input
              {...fieldProps("url")}
              placeholder={labels.urlPlaceholder}
              value={values.url}
              onChange={(event) => change("url", event.target.value)}
            />
            {error("url")}
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor={`${id}-ownerId`} className="block text-sm font-semibold">
              {labels.owner} *
            </label>
            <ProjectPersonPicker
              id={`${id}-ownerId`}
              name="ownerId"
              candidates={customers.map((customer) => ({
                ...customer,
                name: customerDisplayName(customer),
              }))}
              value={ownerId}
              onChange={(value) => change("ownerId", value)}
              title={labels.selectOwner}
              searchLabel={labels.searchOwners}
              unavailableLabel={labels.unavailableOwner}
              labels={labels}
              disabled={
                pending || lockOwner || customersLoading || Boolean(customersError) || noCustomers
              }
              required
              error={errors.ownerId}
            />
            {customersError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {customersError}
              </p>
            ) : customersLoading ? (
              <output className="text-sm text-muted-foreground">{labels.customersLoading}</output>
            ) : noCustomers ? (
              <div className="space-y-2 text-sm">
                <output>{labels.noCustomers}</output>
                {createCustomerHref && (
                  <ProjectLink
                    href={createCustomerHref}
                    className="underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {labels.createCustomer}
                  </ProjectLink>
                )}
              </div>
            ) : null}
            {error("ownerId")}
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor={`${id}-assigneeId`} className="block text-sm font-semibold">
              {labels.assignee}
            </label>
            <ProjectPersonPicker
              id={`${id}-assigneeId`}
              name="assigneeId"
              candidates={assignees}
              value={values.assigneeId}
              onChange={(value) => change("assigneeId", value)}
              title={labels.selectAssignee}
              searchLabel={labels.searchAssignees}
              unavailableLabel={labels.unavailableAssignee}
              labels={labels}
              disabled={pending || assigneesLoading || Boolean(assigneesError)}
              clearable
              error={errors.assigneeId}
            />
            {assigneesError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {assigneesError}
              </p>
            ) : assigneesLoading ? (
              <output className="text-sm text-muted-foreground">{labels.assigneesLoading}</output>
            ) : null}
            {error("assigneeId")}
          </div>
          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              disabled={directoriesUnavailable || noCustomers}
              className={primaryButtonClass}
            >
              {pending ? labels.pending : project ? labels.save : labels.create}
            </button>
          </div>
        </fieldset>
        <Feedback feedback={action.feedback} />
      </form>
      {project && onDelete && (
        <div className="mt-6">
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
    </div>
  );
}
