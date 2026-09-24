import { createFileRoute } from "@tanstack/react-router";

import { LoginPreview } from "@/showroom/login-preview";
export const Route = createFileRoute("/$locale/access-denied")({
  component: () => <LoginPreview view="access-denied" />,
});
