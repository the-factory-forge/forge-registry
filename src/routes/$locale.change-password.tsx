import { createFileRoute } from "@tanstack/react-router";

import { LoginPreview } from "@/showroom/login-preview";
export const Route = createFileRoute("/$locale/change-password")({
  component: () => <LoginPreview view="change-password" />,
});
