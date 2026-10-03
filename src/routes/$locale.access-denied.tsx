import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/access-denied")({
  head: ({ match }) =>
    showroomHead({
      title: "Access denied page demo",
      description:
        "Explore a reusable React access-denied page with configurable messaging and navigation for hosts that enforce their own permissions.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: () => <AuthPreview view="access-denied" />,
});
