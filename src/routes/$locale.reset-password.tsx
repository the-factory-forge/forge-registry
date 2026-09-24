import { createFileRoute } from "@tanstack/react-router";

import { LoginPreview } from "@/showroom/login-preview";
export const Route = createFileRoute("/$locale/reset-password")({
  component: () => <LoginPreview view="reset-password" />,
});
