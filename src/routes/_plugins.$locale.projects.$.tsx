import { createFileRoute } from "@tanstack/react-router";

import { ProjectsPreview } from "@/showroom/projects-preview";

export const Route = createFileRoute("/_plugins/$locale/projects/$")({
  component: ProjectsPreview,
});
