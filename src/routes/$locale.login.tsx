import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
function Page() {
  return <AuthPreview />;
}

export const Route = createFileRoute("/$locale/login")({ component: Page });
