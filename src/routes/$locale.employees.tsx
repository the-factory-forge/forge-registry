import { createFileRoute } from "@tanstack/react-router";

import { EmployeesPreview } from "@/showroom/employees-preview";
import { showroomHead } from "@/showroom/seo";
function Page() {
  return <EmployeesPreview />;
}

export const Route = createFileRoute("/$locale/employees")({
  head: ({ match }) =>
    showroomHead({
      title: "Employee management plugin demo",
      description:
        "Preview an admin-only React employee directory with mock users, create and edit forms, account deletion, and email verification reminders.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: Page,
});
