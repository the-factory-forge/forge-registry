import { createFileRoute } from "@tanstack/react-router";

import { MenuAdminPreview } from "@/showroom/menus-preview";

export const Route = createFileRoute("/_menus/$locale/admin/menus/$")({
  component: MenuAdminPreview,
});
