import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/change-password")({
  head: ({ match }) =>
    showroomHead({
      title: "Change password form demo",
      description:
        "Preview a reusable React password change form for signed-in users with one new-password field and validation using mock callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: () => <AuthPreview view="change-password" />,
});
