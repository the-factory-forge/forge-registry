import { createFileRoute } from "@tanstack/react-router";

import { BlogsPublicPreview } from "@/showroom/blogs-preview";

export const Route = createFileRoute("/_blogs/$locale/blogs/$")({ component: BlogsPublicPreview });
