import type { ProjectsLabels } from "@/components/plugins/projects/labels";
import type {
  Project,
  ProjectFormValues,
  ProjectStatus,
} from "@/components/plugins/projects/types";

export const projectStatuses: readonly ProjectStatus[] = [
  "requested",
  "prospect",
  "under-construction",
  "production",
];

export function projectFormValues(project?: Project): ProjectFormValues {
  return {
    name: project?.name ?? "",
    status: project?.status ?? "requested",
    description: project?.description ?? "",
  };
}

export function validateProject(values: ProjectFormValues, labels: ProjectsLabels) {
  const errors: Partial<Record<keyof ProjectFormValues, string>> = {};
  if (!values.name.trim()) errors.name = labels.nameRequired;
  if (!projectStatuses.includes(values.status)) errors.status = labels.statusInvalid;
  if (values.description.trim().length > 5000) errors.description = labels.descriptionInvalid;
  return errors;
}
