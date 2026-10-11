import { createFileRoute } from "@tanstack/react-router";

import { AccountPreview } from "@/showroom/account-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/account")({
  head: ({ match }) =>
    showroomHead({
      title: "Account profile and security demo",
      description: "Profile, agent keys, sign-in methods and sessions with host callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: AccountPreview,
});
