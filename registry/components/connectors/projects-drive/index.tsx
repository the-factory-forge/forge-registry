import { DriveBrowser, type DriveBrowserProps } from "@/components/plugins/drive";
import type { Project } from "@/components/plugins/projects";

import { projectDriveScope } from "./scope";

export { projectDriveScope } from "./scope";
export type ProjectDriveProps = Omit<DriveBrowserProps, "scope"> & { project: Pick<Project, "id"> };

/** Embed in ProjectDetailPage.driveContent; the host still authorizes every Drive operation. */
export function ProjectDrive({ project, ...props }: ProjectDriveProps) {
  return <DriveBrowser key={project.id} {...props} scope={projectDriveScope(project)} />;
}
