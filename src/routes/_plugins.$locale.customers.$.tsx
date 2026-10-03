import { createFileRoute } from "@tanstack/react-router";

import { CustomersPreview } from "@/showroom/customers-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_plugins/$locale/customers/$")({
  head: ({ params, match }) => {
    const [id, tab] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "new"
        ? {
            title: "New customer form demo",
            description:
              "Preview the React customer creation page with contact fields, validation, and host-owned actions. Created records stay in showroom memory.",
          }
        : tab === "projects"
          ? {
              title: "Customer projects page demo",
              description:
                "Explore the React customer detail layout with a linked project list, customer-scoped project creation, and in-memory sample records.",
            }
          : tab === "sync"
            ? {
                title: "Customer integration section demo",
                description:
                  "Preview the React customer detail layout's Sync section, where consuming sites supply their own integration content and callbacks.",
              }
            : id
              ? {
                  title: "Customer details page demo",
                  description:
                    "Preview a React customer detail page with sample contact information, editing controls, linked projects, and a host-owned integration section.",
                }
              : {
                  title: "Customer management plugin demo",
                  description:
                    "Try a reusable React customer directory with sample contacts, search, creation, detail pages, and linked projects using in-memory demo data.",
                };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: CustomersPreview,
});
