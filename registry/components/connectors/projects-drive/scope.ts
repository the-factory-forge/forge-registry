import type { DriveScope } from "@/components/plugins/drive/types";
import type { Project } from "@/components/plugins/projects/types";

export function projectDriveScope(project: Pick<Project, "id">): DriveScope {
  return { type: "project", id: project.id };
}
