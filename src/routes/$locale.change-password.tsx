import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/change-password")({
  head: ({ match }) =>
    showroomHead({
      title: "Change password form demo",
      description:
        "Preview a reusable React password change form with current and new password fields, confirmation, and validation using mock callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: () => <AuthPreview view="change-password" />,
});
