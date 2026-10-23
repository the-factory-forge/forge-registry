export {
  createProjectsSchema,
  type ProjectsSchema,
  type ProjectRecord,
} from "@/components/plugins/projects/server/schema";
export {
  createProjectsService,
  projectInputSchema,
  projectStatusSchema,
  ProjectsError,
  type ProjectsAction,
  type ProjectsServiceOptions,
} from "@/components/plugins/projects/server/service.server";
