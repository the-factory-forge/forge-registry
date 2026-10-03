import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/forgot-password")({
  head: ({ match }) =>
    showroomHead({
      title: "Password recovery form demo",
      description:
        "Preview a reusable React password recovery form with email validation and request states. The showroom uses mock authentication callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: () => <AuthPreview view="forgot-password" />,
});
