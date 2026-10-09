"use client";

import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useRef } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { Link } from "@/components/link";
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
  ProjectNewPageProps,
  ProjectsListProps,
  ProjectsPageProps,
} from "@/components/plugins/projects/types";
import { DeleteProject, ProjectAvatar, ProjectStatusBadge } from "@/components/plugins/projects/ui";
import { safeProjectUrl } from "@/components/plugins/projects/utils";
import { TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems, useOptimisticAction } from "@/components/utils/use-optimistic-action";

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
  labels: overrides,
  linkComponent: ProjectLink = Link,
  className,
}: ProjectsListProps) {
  const labels = { ...projectLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedProjects);
  const projects = optimistic.value;
  const error = loadError || (optimistic.error ? labels.actionError : undefined);
  const root = useRef<HTMLElement>(null);
  const visibleProjects =
    customerId === undefined
      ? projects
      : projects.filter((project) => project.ownerId === customerId);
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
          {loading && visibleProjects.length > 0 && (
            <caption className="sr-only">
              <output>{labels.loading}</output>
            </caption>
          )}
          <thead>
            <tr className={tableRowClass}>
              {[
                labels.name,
                ...(customerId === undefined ? [labels.owner] : []),
                labels.assignee,
                labels.website,
                labels.status,
                labels.actions,
              ].map((label, index) => (
                <th
                  key={index}
                  scope="col"
                  className={
                    index === (customerId === undefined ? 5 : 4)
                      ? tableActionCellClass
                      : tableHeaderClass
                  }
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {retainRemovedItems(
              visibleProjects,
              suppliedProjects.filter(
                (row) => customerId === undefined || row.ownerId === customerId,
              ),
              optimistic.pending,
            ).map((project) => {
              const owner = owners.get(project.ownerId);
              const assignee = project.assigneeId ? assigned.get(project.assigneeId) : undefined;
              const website = safeProjectUrl(project.url);
              return (
                <tr
                  key={project.id}
                  hidden={!visibleProjects.some((row) => row.id === project.id)}
                  className={tableRowClass}
                >
                  <td className={tableCellClass}>
                    <ProjectLink
                      href={getProjectHref(project)}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
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
                    {website ? (
                      <ProjectLink
                        href={website}
                        target={website.startsWith("/") ? undefined : "_blank"}
                        rel={website.startsWith("/") ? undefined : "noopener noreferrer"}
                        aria-label={labels.visit(project.name)}
                        className={iconButtonClass}
                      >
                        <ExternalLinkIcon aria-hidden="true" />
                      </ProjectLink>
                    ) : (
                      <span className="text-muted-foreground">{labels.noWebsite}</span>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <ProjectStatusBadge status={project.status} labels={labels} />
                  </td>
                  <td className={tableActionCellClass}>
                    <div className="flex items-start justify-end gap-1">
                      <ProjectLink
                        href={getProjectHref(project)}
                        aria-label={labels.edit(project.name)}
                        className={iconButtonClass}
                      >
                        <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                      </ProjectLink>
                      {onDelete && (
                        <DeleteProject
                          project={project}
                          disabled={loading || optimistic.pending || !!loadError}
                          onDelete={(id) =>
                            optimistic.run(
                              (rows) => rows.filter((row) => row.id !== id),
                              () => onDelete(id),
                            )
                          }
                          labels={labels}
                          returnFocus={root}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {((error && !loading) || visibleProjects.length === 0) && (
              <tr className={tableRowClass}>
                <td
                  colSpan={customerId === undefined ? 6 : 5}
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
  driveContent,
  className,
  labels: overrides,
  linkComponent: ProjectLink = Link,
}: ProjectDetailPageProps) {
  const labels = { ...projectLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedProject, suppliedProject.id);
  const project = optimistic.value;
  const website = safeProjectUrl(project.url);
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
          <p className="text-sm break-all text-muted-foreground">
            {website ? (
              <ProjectLink
                href={website}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                target={website.startsWith("/") ? undefined : "_blank"}
                rel={website.startsWith("/") ? undefined : "noopener noreferrer"}
              >
                {website}
              </ProjectLink>
            ) : (
              labels.noWebsite
            )}
          </p>
        </div>
        <div className="ml-auto self-start">
          <ProjectStatusBadge status={project.status} labels={labels} />
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
          labels={labels}
          onSubmit={(values) =>
            optimistic.run(
              (row) => ({ ...row, ...values }),
              () => onSave(values),
            )
          }
          onDelete={onDelete}
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
      <ProjectDetailPageContent {...props} />
    </ActionToastProvider>
  );
}
