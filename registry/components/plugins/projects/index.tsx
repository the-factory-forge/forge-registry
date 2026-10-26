"use client";

import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import {
  buttonClass,
  cardClass,
  iconButtonClass,
  primaryButtonClass,
} from "@/components/plugins/customers/ui";
import { customerDisplayName } from "@/components/plugins/customers/utils";
import { projectLabels } from "@/components/plugins/projects/labels";
import { ProjectForm } from "@/components/plugins/projects/project-form";
import type {
  ProjectDetailPageProps,
  ProjectStatus,
  ProjectNewPageProps,
  ProjectsListProps,
  ProjectsPageProps,
} from "@/components/plugins/projects/types";
import { ProjectAvatar, ProjectStatusBadge } from "@/components/plugins/projects/ui";
import { projectFormValues } from "@/components/plugins/projects/utils";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { TableSearch } from "@/components/table-search";
import {
  TableBulkDelete,
  TableSelectionCheckbox,
  useTableSelection,
} from "@/components/table-selection";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

export type {
  Project,
  ProjectStatus,
  ProjectSection,
  ProjectFormValues,
  ProjectAssignee,
  ProjectsAppearanceProps,
  ProjectsListProps,
  ProjectsPageProps,
  ProjectDetailPageProps,
  ProjectNewPageProps,
} from "@/components/plugins/projects/types";
export type { ProjectsLabels } from "@/components/plugins/projects/labels";

const pageClass = "mx-auto w-full min-w-0 space-y-6 px-4 py-8 text-foreground";

function ProjectsListContent({
  projects: suppliedProjects,
  customers,
  assignees = [],
  customerId,
  search,
  onSearchChange,
  loading,
  error: loadError,
  createHref,
  getProjectHref,
  getCustomerHref,
  onDelete,
  onStatusChange,
  labels: overrides,
  linkComponent: ProjectLink = Link,
  className,
}: ProjectsListProps) {
  useLoadingActivity(!!loading);
  const labels = { ...projectLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedProjects);
  const projects = optimistic.value;
  const error = loadError || (optimistic.error ? labels.actionError : undefined);
  const root = useRef<HTMLElement>(null);
  const visibleProjects =
    customerId === undefined
      ? projects
      : projects.filter((project) => project.ownerId === customerId);
  const deletion = useRecordDeletion({
    items: visibleProjects,
    scope: JSON.stringify([customerId, search]),
    getName: (project) => project.name,
    onDelete,
    label: labels.deleteProject,
    labels,
    disabled: loading || !!loadError || optimistic.pending,
    returnFocus: root,
  });
  const selectable = onDelete ? deletion.items : [];
  const selection = useTableSelection(selectable, `${customerId ?? ""}:${search ?? ""}`);
  const selectionDisabled =
    loading || !!loadError || optimistic.pending || deletion.pending || selection.pending;
  const owners = new Map(customers.map((customer) => [customer.id, customer]));
  const assigned = new Map(assignees.map((assignee) => [assignee.id, assignee]));
  return (
    <section
      ref={root}
      tabIndex={-1}
      aria-label={labels.title}
      className={cn(
        tablePanelClass,
        "min-w-0 space-y-5 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <h2 className="font-semibold">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">
            {customerId === undefined ? labels.description : labels.customerDescription}
          </p>
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <TableSearch
            value={search}
            onValueChange={onSearchChange}
            label={labels.search}
            placeholder={labels.searchPlaceholder}
            clearLabel={labels.clearSearch}
          />
          {createHref && (
            <ProjectLink href={createHref} className={primaryButtonClass}>
              <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.create}
            </ProjectLink>
          )}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className={tableClass} aria-busy={loading}>
          {loading && deletion.items.length > 0 && (
            <caption className="sr-only">
              <output>{labels.loading}</output>
            </caption>
          )}
          <thead>
            <tr className={tableRowClass}>
              {onDelete && (
                <th scope="col" className="w-10 p-2">
                  <TableSelectionCheckbox
                    label={labels.selectAllRows}
                    checked={selection.all}
                    mixed={selection.mixed}
                    onChange={selection.toggleAll}
                    disabled={selectionDisabled || !selectable.length}
                  />
                </th>
              )}
              {[
                labels.name,
                ...(customerId === undefined ? [labels.owner] : []),
                labels.assignee,
                labels.status,
                labels.actions,
              ].map((label, index) => (
                <th
                  key={index}
                  scope="col"
                  className={
                    index === (customerId === undefined ? 4 : 3)
                      ? tableActionHeaderClass
                      : tableHeaderClass
                  }
                >
                  <div
                    className={
                      index === (customerId === undefined ? 4 : 3)
                        ? "flex items-center justify-end gap-2"
                        : undefined
                    }
                  >
                    {label}
                    {index === (customerId === undefined ? 4 : 3) && (
                      <>
                        {onDelete && (
                          <TableBulkDelete
                            selection={selection}
                            getName={(project) => project.name}
                            onDelete={(project) => onDelete!(project.id)}
                            labels={labels}
                            disabled={selectionDisabled}
                          />
                        )}
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {deletion.items.map((project) => {
              const owner = owners.get(project.ownerId);
              const assignee = project.assigneeId ? assigned.get(project.assigneeId) : undefined;
              return (
                <tr
                  key={project.id}
                  hidden={selection.isDeleting(project.id)}
                  className={tableRowClass}
                >
                  {onDelete && (
                    <td className="w-10 p-2">
                      <TableSelectionCheckbox
                        label={`${labels.selectRow}: ${project.name}`}
                        checked={selection.selected.some((row) => row.id === project.id)}
                        mixed={false}
                        onChange={(checked) => selection.toggle(project.id, checked)}
                        disabled={selectionDisabled}
                      />
                    </td>
                  )}
                  <td className={tableCellClass}>
                    <ProjectLink
                      href={getProjectHref(project)}
                      className="font-medium whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {project.name}
                    </ProjectLink>
                  </td>
                  {customerId === undefined && (
                    <td className={tableCellClass}>
                      {owner ? (
                        getCustomerHref ? (
                          <ProjectLink
                            href={getCustomerHref(owner)}
                            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {customerDisplayName(owner)}
                          </ProjectLink>
                        ) : (
                          customerDisplayName(owner)
                        )
                      ) : (
                        labels.unavailableOwner
                      )}
                    </td>
                  )}
                  <td className={tableCellClass}>
                    {assignee?.name ??
                      (project.assigneeId ? labels.unavailableAssignee : labels.unassigned)}
                  </td>
                  <td className={tableCellClass}>
                    <ProjectStatusBadge
                      status={project.status}
                      name={project.name}
                      labels={labels}
                      disabled={selectionDisabled}
                      onChange={
                        onStatusChange
                          ? (status) =>
                              optimistic.run(
                                (rows) =>
                                  rows.map((row) =>
                                    row.id === project.id ? { ...row, status } : row,
                                  ),
                                () => onStatusChange(project.id, status),
                              )
                          : undefined
                      }
                    />
                  </td>
                  <td className={tableActionCellClass}>
                    <div className={tableActionsClass}>
                      <IconTooltip label={labels.edit(project.name)}>
                        <ProjectLink
                          href={getProjectHref(project)}
                          aria-label={labels.edit(project.name)}
                          className={iconButtonClass}
                        >
                          <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                        </ProjectLink>
                      </IconTooltip>
                      {onDelete && (
                        <RecordDeleteButton
                          label={labels.deleteProject}
                          disabled={selectionDisabled}
                          onClick={(event) => deletion.open(project.id, event.currentTarget)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {((error && !loading) || deletion.items.length === 0) && (
              <tr className={tableRowClass}>
                <td
                  colSpan={(customerId === undefined ? 5 : 4) + (onDelete ? 1 : 0)}
                  className={cn(tableCellClass, "py-10 text-center text-muted-foreground")}
                >
                  {error && !loading ? (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  ) : (
                    <output>{loading ? labels.loading : labels.empty}</output>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {deletion.dialog}
    </section>
  );
}

export function ProjectsPage({ className, ...props }: ProjectsPageProps) {
  return (
    <div className={cn(pageClass, className)}>
      <h1 className="sr-only">{props.labels?.title ?? projectLabels.title}</h1>
      <ProjectsList {...props} />
    </div>
  );
}

function ProjectDetailPageContent({
  project: suppliedProject,
  section = "details",
  backHref,
  sectionHrefs,
  onSave,
  onDelete,
  onStatusChange,
  driveContent,
  className,
  labels: overrides,
  linkComponent: ProjectLink = Link,
}: ProjectDetailPageProps) {
  const labels = { ...projectLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedProject, suppliedProject.id);
  const project = optimistic.value;
  const [statusUpdate, setStatusUpdate] = useState<{ status: ProjectStatus }>();
  return (
    <div className={cn(pageClass, className)}>
      <ProjectLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        {labels.back}
      </ProjectLink>
      <header className={cn(cardClass, "flex flex-wrap items-center gap-4")}>
        <ProjectAvatar name={project.name} image={project.posterImage} large />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold break-words">{project.name}</h1>
        </div>
        <div className="ml-auto self-start">
          <ProjectStatusBadge
            status={project.status}
            name={project.name}
            labels={labels}
            disabled={optimistic.pending}
            onChange={async (status) => {
              await optimistic.run(
                (row) => ({ ...row, status }),
                () =>
                  onStatusChange
                    ? onStatusChange(project.id, status)
                    : onSave({ ...projectFormValues(project), status }),
                () => setStatusUpdate({ status }),
              );
            }}
          />
        </div>
      </header>
      <nav aria-label={labels.sections} className="flex overflow-x-auto border-b border-border">
        {(["details", "drive"] as const).map((tab) => (
          <ProjectLink
            key={tab}
            href={sectionHrefs[tab]}
            aria-current={section === tab ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              section === tab && "border-primary text-primary",
            )}
          >
            {labels[tab]}
          </ProjectLink>
        ))}
      </nav>
      {section === "details" ? (
        <ProjectForm
          key={project.id}
          project={project}
          statusUpdate={statusUpdate}
          labels={labels}
          onSubmit={(values) =>
            optimistic.run(
              (row) => ({ ...row, ...values }),
              () => onSave(values),
            )
          }
          disabled={optimistic.pending}
          onDelete={
            onDelete
              ? (id) =>
                  optimistic.run(
                    (row) => row,
                    () => onDelete(id),
                  )
              : undefined
          }
        />
      ) : (
        driveContent
      )}
    </div>
  );
}

export function ProjectNewPage({
  backHref,
  onCreate,
  className,
  labels: overrides,
  linkComponent: ProjectLink = Link,
}: ProjectNewPageProps) {
  const labels = { ...projectLabels, ...overrides };
  return (
    <div className={cn(pageClass, className)}>
      <ProjectLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        {labels.back}
      </ProjectLink>
      <header className={cn(cardClass, "space-y-1.5")}>
        <h1 className="font-semibold">{labels.newTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.newDescription}</p>
      </header>
      <ProjectForm labels={labels} onSubmit={onCreate} />
    </div>
  );
}

export function ProjectsList(props: ProjectsListProps) {
  return (
    <ActionToastProvider>
      <ProjectsListContent {...props} />
    </ActionToastProvider>
  );
}

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  return (
    <ActionToastProvider>
      <ProjectDetailPageContent key={props.project.id} {...props} />
    </ActionToastProvider>
  );
}
