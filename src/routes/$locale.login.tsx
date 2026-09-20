import { createFileRoute } from "@tanstack/react-router";

import { LoginPreview } from "@/showroom/login-preview";
function Page() {
  return <LoginPreview />;
}

export const Route = createFileRoute("/$locale/login")({ component: Page });
