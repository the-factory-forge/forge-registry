"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { customerDisplayName } from "@/components/plugins/customers/utils";
import {
  ProjectDetailPage,
  ProjectNewPage,
  ProjectsList,
  ProjectsPage,
  type Project,
  type ProjectFormValues,
} from "@/components/plugins/projects";
import { EmbeddedDrivePreview } from "@/showroom/drive-preview";
import { previewAssignees, usePluginsPreview } from "@/showroom/plugins-preview";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";

function useProjectList(customerId?: string) {
  const state = usePluginsPreview();
  const { locale } = useShowroomParams();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const base = `/${locale}/projects`;
  const context = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
  return {
    projects: state.projects.filter((project) =>
      [
        project.name,
        project.description,
        state.customers.find((customer) => customer.id === project.ownerId)?.companyName,
        state.customers.find((customer) => customer.id === project.ownerId)?.name,
      ].some((text) => text?.toLowerCase().includes(query)),
    ),
    customers: state.customers,
    assignees: previewAssignees,
    customerId,
    search,
    onSearchChange: setSearch,
    loading: state.directoryState === "loading",
    error: state.directoryState === "error" ? "Unable to load projects. Try again." : undefined,
    createHref: state.showActions ? `${base}/new${context}` : undefined,
    getProjectHref: (project: Project) => `${base}/${encodeURIComponent(project.id)}${context}`,
    getCustomerHref: (customer: { id: string }) =>
      `/${locale}/customers/${encodeURIComponent(customer.id)}`,
    onDelete: state.showActions
      ? async (id: string) => {
          await state.beforeAction();
          state.driveMock.assertEmpty({ type: "project", id });
          state.setProjects((current) => current.filter((project) => project.id !== id));
          state.setNotice("Project deleted successfully.");
        }
      : undefined,
    linkComponent: Link,
  };
}

export function CustomerProjectsPreview({ customerId }: { customerId: string }) {
  const props = useProjectList(customerId);
  return <ProjectsList {...props} />;
}

export function ProjectsPreview() {
  const state = usePluginsPreview();
  const params = useShowroomParams();
  const query = useSearch({ strict: false });
  const navigate = useNavigate();
  const listProps = useProjectList();
  const [projectId, tab] = params.segments ?? [];
  const project = state.projects.find((entry) => entry.id === projectId);
  const requestedCustomerId = query.customerId;
  const customer = state.customers.find((entry) => entry.id === requestedCustomerId);
  const fromCustomer = Boolean(
    customer && (projectId === "new" || project?.ownerId === customer.id),
  );
  const base = `/${params.locale}/projects`;
  const customerBase = `/${params.locale}/customers`;
  const context = fromCustomer && customer ? `?customerId=${encodeURIComponent(customer.id)}` : "";
  const backHref = fromCustomer && customer ? `${customerBase}/${customer.id}/projects` : base;
  const directories = {
    customers:
      state.peopleState === "empty"
        ? []
        : state.peopleState === "unavailable"
          ? state.customers.filter((entry) => entry.id !== (project?.ownerId ?? customer?.id))
          : state.customers,
    customersLoading: state.peopleState === "loading",
    customersError:
      state.peopleState === "error" ? "Unable to load customers. Try again." : undefined,
    assignees: previewAssignees,
    assigneesLoading: state.peopleState === "loading",
    assigneesError:
      state.peopleState === "error" ? "Unable to load assignees. Try again." : undefined,
    createCustomerHref: `${customerBase}/new`,
    defaultOwnerId: fromCustomer ? customer?.id : undefined,
    lockOwner: fromCustomer,
    linkComponent: Link,
    labels: { back: fromCustomer ? "Back to Customer Projects" : "Back to Projects" },
  };
  async function validateOwner(values: ProjectFormValues) {
    await state.beforeAction();
    if (!state.customers.some((entry) => entry.id === values.ownerId))
      throw new Error("Owner must be an existing customer");
  }

  if (!projectId) return <ProjectsPage {...listProps} />;
  if (
    (params.segments?.length ?? 0) > 2 ||
    (projectId === "new" ? Boolean(tab) : !project || Boolean(tab && tab !== "drive"))
  )
    return (
      <div className="space-y-4 p-8">
        <h1 className="text-xl font-semibold">Project page not found</h1>
        <Link href={base} className="underline">
          Back to Projects
        </Link>
      </div>
    );
  if (projectId === "new")
    return (
      <ProjectNewPage
        {...directories}
        backHref={backHref}
        onCreate={async (values) => {
          await validateOwner(values);
          const id = crypto.randomUUID();
          state.setProjects((current) => [...current, { ...values, id }]);
          state.setNotice("Project created successfully.");
          await navigate({ href: `${base}/${id}${context}` });
        }}
      />
    );
  if (!project) return null;
  return (
    <ProjectDetailPage
      {...directories}
      project={project}
      section={tab === "drive" ? "drive" : "details"}
      backHref={backHref}
      sectionHrefs={{
        details: `${base}/${project.id}${context}`,
        drive: `${base}/${project.id}/drive${context}`,
      }}
      onSave={async (values) => {
        await validateOwner(values);
        state.setProjects((current) =>
          current.map((entry) => (entry.id === project.id ? { ...entry, ...values } : entry)),
        );
      }}
      onDelete={
        state.showActions
          ? async (id) => {
              await listProps.onDelete?.(id);
              await navigate({ href: backHref });
            }
          : undefined
      }
      driveContent={
        state.showDrive ? (
          <EmbeddedDrivePreview
            scope={{ type: "project", id: project.id }}
            base={`${base}/${project.id}/drive`}
            customerId={fromCustomer ? customer?.id : undefined}
          />
        ) : state.showIntegration ? (
          <p>
            Host Drive content for {project.name}, owned by{" "}
            {customerDisplayName(state.customers.find((entry) => entry.id === project.ownerId)!)}.
          </p>
        ) : undefined
      }
    />
  );
}
