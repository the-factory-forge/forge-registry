import { createFileRoute } from "@tanstack/react-router";

import { EmployeesPreview } from "@/showroom/employees-preview";
function Page() {
  return <EmployeesPreview />;
}

export const Route = createFileRoute("/$locale/employees")({ component: Page });
