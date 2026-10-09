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

export function safeProjectUrl(input: string | null | undefined): string | undefined {
  const value = input?.trim();
  // oxlint-disable-next-line no-control-regex -- Reject controls before URL normalization.
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (!/^https?:\/\//i.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? value : undefined;
  } catch {
    return undefined;
  }
}

export function validateProject(values: ProjectFormValues, labels: ProjectsLabels) {
  const errors: Partial<Record<keyof ProjectFormValues, string>> = {};
  if (!values.name.trim()) errors.name = labels.nameRequired;
  if (!projectStatuses.includes(values.status)) errors.status = labels.statusInvalid;
  if (values.description.trim().length > 5000) errors.description = labels.descriptionInvalid;
  return errors;
}
