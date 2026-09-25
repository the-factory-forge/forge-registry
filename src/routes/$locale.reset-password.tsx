import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
export const Route = createFileRoute("/$locale/reset-password")({
  component: () => <AuthPreview view="reset-password" />,
});
