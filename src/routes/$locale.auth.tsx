import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/$locale/auth")({
  head: ({ match }) =>
    showroomHead({
      title: "Authentication components demo",
      description:
        "Explore React authentication components for sign-in, sign-out, password recovery, password changes, and access-denied states using mock callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: AuthPreview,
});
