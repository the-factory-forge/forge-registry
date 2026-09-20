import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PluginsPreviewProvider } from "@/showroom/plugins-preview";

export const Route = createFileRoute("/_plugins")({
  component: () => (
    <PluginsPreviewProvider>
      <Outlet />
    </PluginsPreviewProvider>
  ),
});
