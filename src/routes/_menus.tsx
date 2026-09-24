import { createFileRoute, Outlet } from "@tanstack/react-router";

import { MenusPreviewProvider } from "@/showroom/menus-preview";

export const Route = createFileRoute("/_menus")({
  component: () => (
    <MenusPreviewProvider>
      <Outlet />
    </MenusPreviewProvider>
  ),
});
