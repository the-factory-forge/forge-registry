import type { ComponentType, ReactNode } from "react";

import type { LinkProps } from "@/components/link";
import type { Customer } from "@/components/plugins/customers";
import type { ProjectsLabels } from "@/components/plugins/projects/labels";

export type ProjectStatus = "requested" | "prospect" | "under-construction" | "production";
export type ProjectSection = "details" | "drive";

export interface Project {
  id: string;
  name: string;
  ownerId: Customer["id"];
  status: ProjectStatus;
  description?: string | null;
  url?: string | null;
  posterImage?: string | null;
  assigneeId?: string | null;
}

export interface ProjectFormValues {
  name: string;
  status: ProjectStatus;
  description: string;
  url: string;
  ownerId: Customer["id"];
  assigneeId: string;
}

export interface ProjectAssignee {
  id: string;
  name: string;
  email?: string | null;
  image?: string | null;
}

export interface ProjectsAppearanceProps {
  className?: string;
  labels?: Partial<ProjectsLabels>;
  linkComponent?: ComponentType<LinkProps>;
}

export interface ProjectsListProps extends ProjectsAppearanceProps {
  projects: readonly Project[];
  customers: readonly Customer[];
  assignees?: readonly ProjectAssignee[];
  customerId?: Customer["id"];
  search: string;
  onSearchChange: (search: string) => void;
  loading?: boolean;
  error?: string;
  createHref?: string;
  getProjectHref: (project: Project) => string;
  getCustomerHref?: (customer: Customer) => string;
  onDelete?: (projectId: string) => Promise<void>;
}

export type ProjectsPageProps = ProjectsListProps;

export interface ProjectDirectoryProps {
  customers: readonly Customer[];
  customersLoading?: boolean;
  customersError?: string;
  createCustomerHref?: string;
  assignees?: readonly ProjectAssignee[];
  assigneesLoading?: boolean;
  assigneesError?: string;
  defaultOwnerId?: Customer["id"];
  lockOwner?: boolean;
}

export interface ProjectDetailPageProps extends ProjectsAppearanceProps, ProjectDirectoryProps {
  project: Project;
  section?: ProjectSection;
  backHref: string;
  sectionHrefs: Record<ProjectSection, string>;
  onSave: (values: ProjectFormValues) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  driveContent?: ReactNode;
}

export interface ProjectNewPageProps extends ProjectsAppearanceProps, ProjectDirectoryProps {
  backHref: string;
  onCreate: (values: ProjectFormValues) => Promise<void>;
}
