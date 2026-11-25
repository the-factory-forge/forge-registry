import { createFileRoute, Outlet } from "@tanstack/react-router";

import { createBlogsMock } from "@/showroom/blogs-mock";
import { BlogsPreviewProvider } from "@/showroom/blogs-preview";

export const Route = createFileRoute("/_blogs")({
  gcTime: 0,
  context: () => ({ blogsMock: createBlogsMock() }),
  component: () => (
    <BlogsPreviewProvider>
      <Outlet />
    </BlogsPreviewProvider>
  ),
});
