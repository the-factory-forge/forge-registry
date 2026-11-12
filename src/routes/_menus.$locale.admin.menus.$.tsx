import { createFileRoute } from "@tanstack/react-router";

import { MenuAdminPreview } from "@/showroom/menus-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_menus/$locale/admin/menus/$")({
  validateSearch: (search: Record<string, unknown>) => ({
    menuSearch:
      typeof search.menuSearch === "string" && /^[0-9a-f-]{36}$/i.test(search.menuSearch)
        ? search.menuSearch
        : undefined,
    menuQuery: typeof search.menuQuery === "string" ? search.menuQuery.slice(0, 100) : undefined,
  }),
  head: ({ params, match }) => {
    const segments = params._splat?.split("/").filter(Boolean) ?? [];
    const scoped = segments[0] === "menu";
    const id = segments[scoped ? 2 : 0];
    const page =
      id === "print"
        ? {
            title: "Restaurant menu printer demo",
            description:
              "Preview an A4 or A5 restaurant menu with current dishes, prices and labels, then print or save a PDF through your browser.",
          }
        : id === "new"
          ? {
              title: "New menu item editor demo",
              description:
                "Preview the React menu item editor with translated descriptions, prices, categories, dietary labels, and photos using in-memory demo data.",
            }
          : id === "taxonomy" || id === "labels"
            ? {
                title: "Menu categories and labels demo",
                description:
                  "Explore React restaurant menu category and label management with translated names, dietary information, and allergen labels.",
              }
            : id === "preview" || id === "card-preview"
              ? {
                  title: "Web and paper menu preview",
                  description: "Inspect a saved menu on the web or on paper before printing.",
                }
              : id && id !== "items" && id !== "create-menu"
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
      noIndex: scoped || Boolean(id) || match.status !== "success",
    });
  },
  component: MenuAdminPreview,
});
