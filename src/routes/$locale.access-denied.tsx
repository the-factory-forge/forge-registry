import { createFileRoute } from "@tanstack/react-router";

import { AuthPreview } from "@/showroom/auth-preview";
export const Route = createFileRoute("/$locale/access-denied")({
  component: () => <AuthPreview view="access-denied" />,
});
