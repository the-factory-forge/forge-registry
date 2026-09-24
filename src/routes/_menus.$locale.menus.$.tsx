import { createFileRoute } from "@tanstack/react-router";

import { MenuPublicPreview } from "@/showroom/menus-preview";

export const Route = createFileRoute("/_menus/$locale/menus/$")({ component: MenuPublicPreview });
