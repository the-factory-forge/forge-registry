import { createFileRoute } from "@tanstack/react-router";

import { LoginPreview } from "@/showroom/login-preview";
export const Route = createFileRoute("/$locale/forgot-password")({
  component: () => <LoginPreview view="forgot-password" />,
});
