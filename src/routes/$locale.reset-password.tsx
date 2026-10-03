import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/reset-password")({
  head: ({ match }) =>
    showroomHead({
      title: "Password reset form demo",
      description:
        "Test a reusable React password reset form with password confirmation, validation, and success and error states using mock callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: () => <AuthPreview view="reset-password" />,
});
