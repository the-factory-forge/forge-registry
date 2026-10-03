import { createFileRoute } from "@tanstack/react-router";

import { BlogsPublicPreview } from "@/showroom/blogs-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_blogs/$locale/blogs/$")({
  head: ({ params, match }) => {
    const [id] = params._splat?.split("/").filter(Boolean) ?? [];
    const page = id
      ? {
          title: "Blog article page demo",
          description:
            "Preview a React blog article layout with sample Markdown content, images, categories, author details, and links to available translations.",
        }
      : {
          title: "Blog pages plugin demo",
          description:
            "Explore React blog pages with sample Markdown articles, categories, search, pagination, images, and translated publication previews.",
        };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: BlogsPublicPreview,
});
