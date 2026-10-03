import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
import { showroomHead } from "@/showroom/seo";
function Page() {
  return <AuthPreview />;
}

export const Route = createFileRoute("/$locale/login")({
  head: ({ match }) =>
    showroomHead({
      title: "Authentication components demo",
      description:
        "Explore React authentication components for sign-in, sign-out, password recovery, password changes, and access-denied states using mock callbacks.",
      path: match.pathname,
      canonicalPath: match.pathname.replace(/\/login\/?$/, "/auth"),
      noIndex: match.status !== "success",
    }),
  component: Page,
});
