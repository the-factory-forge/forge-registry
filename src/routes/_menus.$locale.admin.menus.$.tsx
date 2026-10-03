import { createFileRoute } from "@tanstack/react-router";

import { MenuAdminPreview } from "@/showroom/menus-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_menus/$locale/admin/menus/$")({
  head: ({ params, match }) => {
    const [id] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "new"
        ? {
            title: "New menu item editor demo",
            description:
              "Preview the React menu item editor with translated descriptions, prices, categories, dietary labels, and photos using in-memory demo data.",
          }
        : id === "taxonomy"
          ? {
              title: "Menu categories and labels demo",
              description:
                "Explore React restaurant menu category and label management with translated names, dietary information, and allergen labels.",
            }
          : id
            ? {
                title: "Menu item editor demo",
                description:
                  "Try the React editor for a sample restaurant menu item, including translations, pricing, categories, dietary labels, and linked photos.",
              }
            : {
                title: "Restaurant menu administration demo",
                description:
                  "Try React restaurant menu management with sample dishes, translated descriptions, prices, visibility, dietary labels, and item photos.",
              };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: MenuAdminPreview,
});
