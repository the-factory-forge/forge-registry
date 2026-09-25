import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
export const Route = createFileRoute("/$locale/forgot-password")({
  component: () => <AuthPreview view="forgot-password" />,
});
