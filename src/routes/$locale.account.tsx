import { createFileRoute } from "@tanstack/react-router";

import { AccountPreview } from "@/showroom/account-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/account")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; employees?: true } => {
    const employees = search.employees === true || search.employees === "true";
    return {
      employees: employees ? true : undefined,
      tab:
        search.tab === "security" || (employees && search.tab === "employee")
          ? search.tab
          : undefined,
    };
  },
  head: ({ match }) =>
    showroomHead({
      title: "Account profile and security demo",
      description: "Profile, agent keys, sign-in methods and sessions with host callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: AccountPreview,
});
