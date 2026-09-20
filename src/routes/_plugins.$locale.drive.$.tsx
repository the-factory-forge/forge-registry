import { createFileRoute } from "@tanstack/react-router";

import { DrivePreview } from "@/showroom/drive-preview";

export const Route = createFileRoute("/_plugins/$locale/drive/$")({ component: DrivePreview });
