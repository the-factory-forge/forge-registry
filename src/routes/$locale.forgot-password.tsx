import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/$locale/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email.trim() || undefined : undefined,
  }),
  head: ({ match }) =>
    showroomHead({
      title: "Password recovery form demo",
      description:
        "Preview a reusable React password recovery form with email validation and request states. The showroom uses mock authentication callbacks.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),

  component: ForgotPasswordPreview,
});

function ForgotPasswordPreview() {
  const { email } = Route.useSearch();
  return <AuthPreview view="forgot-password" defaultEmail={email} />;
}
