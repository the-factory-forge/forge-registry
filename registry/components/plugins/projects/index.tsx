"use client";

import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useRef } from "react";

import { Link } from "@/components/link";
import {
  buttonClass,
  cardClass,
  inputClass,
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
import { cn } from "@/components/utils/cn";

export type {
  Project,
  ProjectStatus,
  ProjectSection,
  ProjectFormValues,
  ProjectAssignee,
  ProjectsAppearanceProps,
  ProjectDirectoryProps,
  ProjectsListProps,
  ProjectsPageProps,
  ProjectDetailPageProps,
  ProjectNewPageProps,
} from "@/components/plugins/projects/types";
export type { ProjectsLabels } from "@/components/plugins/projects/labels";

const pageClass = "mx-auto w-full min-w-0 space-y-6 px-4 py-8 text-foreground";

export function ProjectsList({
  projects,
  customers,
  assignees = [],
  customerId,
  search,
  onSearchChange,
  loading,
  error,
  createHref,
  getProjectHref,
  getCustomerHref,
  onDelete,
  labels: overrides,
  linkComponent: ProjectLink = Link,
  className,
}: ProjectsListProps) {
  const labels = { ...projectLabels, ...overrides };
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
        cardClass,
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
        {createHref && (
          <ProjectLink href={createHref} className={primaryButtonClass}>
            <PlusIcon aria-hidden="true" />
            {labels.create}
          </ProjectLink>
        )}
      </header>
      <div className="relative max-w-sm">
        <SearchIcon
          aria-hidden="true"
          className="absolute top-2 left-3 size-4 text-muted-foreground"
        />
        <input
          aria-label={labels.search}
          placeholder={labels.searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className={cn(inputClass, "pl-9")}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : loading ? (
        <output className="py-10 text-center text-sm text-muted-foreground">
          {labels.loading}
        </output>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
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
                    className="px-3 py-3 font-medium text-muted-foreground last:text-right"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => {
                const owner = owners.get(project.ownerId);
                const assignee = project.assigneeId ? assigned.get(project.assigneeId) : undefined;
                const website = safeProjectUrl(project.url);
                return (
                  <tr key={project.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3">
                      <ProjectLink
                        href={getProjectHref(project)}
                        className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {project.name}
                      </ProjectLink>
                    </td>
                    {customerId === undefined && (
                      <td className="px-3 py-3">
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
                    <td className="px-3 py-3">
                      {assignee?.name ??
                        (project.assigneeId ? labels.unavailableAssignee : labels.unassigned)}
                    </td>
                    <td className="px-3 py-3">
                      {website ? (
                        <ProjectLink
                          href={website}
                          target={website.startsWith("/") ? undefined : "_blank"}
                          rel={website.startsWith("/") ? undefined : "noopener noreferrer"}
                          aria-label={labels.visit(project.name)}
                          className={buttonClass}
                        >
                          <ExternalLinkIcon aria-hidden="true" />
                        </ProjectLink>
                      ) : (
                        <span className="text-muted-foreground">{labels.noWebsite}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ProjectStatusBadge status={project.status} labels={labels} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start justify-end gap-1">
                        <ProjectLink
                          href={getProjectHref(project)}
                          aria-label={labels.edit(project.name)}
                          className={buttonClass}
                        >
                          <PencilIcon aria-hidden="true" />
                        </ProjectLink>
                        {onDelete && (
                          <DeleteProject
                            project={project}
                            onDelete={onDelete}
                            labels={labels}
                            returnFocus={root}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleProjects.length && (
                <tr>
                  <td
                    colSpan={customerId === undefined ? 6 : 5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {labels.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
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

export function ProjectDetailPage({
  project,
  section = "details",
  backHref,
  sectionHrefs,
  onSave,
  onDelete,
  driveContent,
  className,
  labels: overrides,
  linkComponent: ProjectLink = Link,
  ...directory
}: ProjectDetailPageProps) {
  const labels = { ...projectLabels, ...overrides };
  const website = safeProjectUrl(project.url);
  return (
    <div className={cn(pageClass, className)}>
      <ProjectLink href={backHref} className={buttonClass}>
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
        <ProjectStatusBadge status={project.status} labels={labels} />
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
          {...directory}
          project={project}
          labels={labels}
          onSubmit={onSave}
          onDelete={onDelete}
          linkComponent={ProjectLink}
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
  ...directory
}: ProjectNewPageProps) {
  const labels = { ...projectLabels, ...overrides };
  return (
    <div className={cn(pageClass, className)}>
      <ProjectLink href={backHref} className={buttonClass}>
        <ArrowLeftIcon aria-hidden="true" />
        {labels.back}
      </ProjectLink>
      <header className={cn(cardClass, "space-y-1.5")}>
        <h1 className="font-semibold">{labels.newTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.newDescription}</p>
      </header>
      <ProjectForm
        key={directory.defaultOwnerId ?? "new"}
        {...directory}
        labels={labels}
        onSubmit={onCreate}
        linkComponent={ProjectLink}
      />
    </div>
  );
}
