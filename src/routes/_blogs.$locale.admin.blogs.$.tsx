import { createFileRoute } from "@tanstack/react-router";

import { BlogsAdminPreview } from "@/showroom/blogs-preview";

export const Route = createFileRoute("/_blogs/$locale/admin/blogs/$")({
  component: BlogsAdminPreview,
});
