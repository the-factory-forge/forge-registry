import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
export const Route = createFileRoute("/$locale/change-password")({
  component: () => <AuthPreview view="change-password" />,
});
