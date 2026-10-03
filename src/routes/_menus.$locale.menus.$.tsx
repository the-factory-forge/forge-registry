import { createFileRoute } from "@tanstack/react-router";

import { MenuPublicPreview } from "@/showroom/menus-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_menus/$locale/menus/$")({
  head: ({ params, match }) =>
    showroomHead({
      title: "Restaurant menu plugin demo",
      description:
        "Preview a reusable React restaurant menu with sample dishes, categories, prices, dietary and allergen labels, and translated content.",
      path: match.pathname,
      canonicalPath: `/${params.locale}/menus`,
      noIndex: match.status !== "success",
    }),
  component: MenuPublicPreview,
});
