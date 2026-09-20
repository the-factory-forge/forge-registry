import { createFileRoute, Outlet } from "@tanstack/react-router";

import { BlogsPreviewProvider } from "@/showroom/blogs-preview";

export const Route = createFileRoute("/_blogs")({
  component: () => (
    <BlogsPreviewProvider>
      <Outlet />
    </BlogsPreviewProvider>
  ),
});
