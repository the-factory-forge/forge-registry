import { createFileRoute } from "@tanstack/react-router";

import { BlogsAdminPreview } from "@/showroom/blogs-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_blogs/$locale/admin/blogs/$")({
  head: ({ params, match }) => {
    const [id] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "new"
        ? {
            title: "New blog post editor demo",
            description:
              "Preview the React blog editor with Markdown content, translated drafts, images, and publication controls using in-memory demo data.",
          }
        : id === "categories"
          ? {
              title: "Blog categories editor demo",
              description:
                "Explore React blog category management with translated labels and sample articles. Category changes stay in showroom memory.",
            }
          : id
            ? {
                title: "Blog post editor demo",
                description:
                  "Explore the React blog editor with a sample article, translated drafts, Markdown editing, shared images, and publication status controls.",
              }
            : {
                title: "Blog administration demo",
                description:
                  "Try React blog management with sample posts, Markdown editing, translation drafts, shared images, categories, and publishing controls.",
              };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: BlogsAdminPreview,
});
