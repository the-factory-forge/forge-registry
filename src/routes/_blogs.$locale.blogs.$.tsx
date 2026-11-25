import { createFileRoute } from "@tanstack/react-router";

import { BlogsPublicPreview, BlogPublicNotFound } from "@/showroom/blogs-preview";
import { requireCanonicalRecord } from "@/showroom/public-record";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_blogs/$locale/blogs/$")({
  preloadStaleTime: 0,
  loader: {
    staleReloadMode: "blocking",
    handler: async ({ params, context, location }) => {
      const { locale, _splat: identifier } = params;
      if (!identifier) return null;
      const post = await context.blogsMock.getPublished(locale, identifier);
      return requireCanonicalRecord(post, identifier, `/${locale}/blogs`, location);
    },
  },
  notFoundComponent: BlogPublicNotFound,
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
