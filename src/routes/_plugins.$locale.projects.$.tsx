import { createFileRoute } from "@tanstack/react-router";

import { ProjectsPreview } from "@/showroom/projects-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_plugins/$locale/projects/$")({
  head: ({ params, match }) => {
    const [id, tab] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "new"
        ? {
            title: "New project form demo",
            description:
              "Try the React project creation page with customer ownership, assignees, and validation. Created projects stay in showroom memory.",
          }
        : tab === "drive"
          ? {
              title: "Project file browser demo",
              description:
                "Explore a project's sample folders and files through the React Drive plugin, with host-owned upload, download, rename, and delete actions.",
            }
          : id
            ? {
                title: "Project details page demo",
                description:
                  "Preview a React project detail page with a sample customer, description, assignees, editing controls, and linked project files.",
              }
            : {
                title: "Project management plugin demo",
                description:
                  "Explore a React project directory with sample customers, assignees, project details, creation, and file spaces using in-memory demo data.",
              };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: ProjectsPreview,
});
