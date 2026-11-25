import { createFileRoute } from "@tanstack/react-router";

import { SUPPORT_DEFAULT_SORT, supportSortSchema } from "@/components/plugins/supports/schema";
import { initialSortDirection } from "@/components/utils/table-sort-state";
import { showroomHead } from "@/showroom/seo";
import { SupportsPreview } from "@/showroom/supports-preview";

export const Route = createFileRoute("/_supports/$locale/intranet_/supports/$")({
  validateSearch: (input: Record<string, unknown>) => {
    const sort = supportSortSchema.safeParse({
      field: input.sort,
      direction:
        input.direction === undefined
          ? initialSortDirection(input.sort, SUPPORT_DEFAULT_SORT)
          : input.direction,
    }).data;
    return {
      search:
        typeof input.search === "string" ? input.search.slice(0, 250) || undefined : undefined,
      page:
        /^\d{1,7}$/.test(String(input.page)) &&
        Number(input.page) > 1 &&
        Number(input.page) <= 1000000
          ? String(Number(input.page))
          : undefined,
      sort: sort?.field,
      direction: sort?.direction,
    };
  },
  head: ({ match }) =>
    showroomHead({
      title: "Support tickets plugin demo",
      description:
        "Create staff support tickets with Markdown, private image attachments, replies and open or closed status.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: SupportsPreview,
});
