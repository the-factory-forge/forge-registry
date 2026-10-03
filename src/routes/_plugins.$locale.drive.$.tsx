import { createFileRoute } from "@tanstack/react-router";

import { DrivePreview } from "@/showroom/drive-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_plugins/$locale/drive/$")({
  head: ({ params, match }) => {
    const [id] = params._splat?.split("/").filter(Boolean) ?? [];
    const page = id
      ? {
          title: "File space browser demo",
          description:
            "Try the React Drive browser inside a sample file space with folder navigation, uploads, downloads, and file management controls.",
        }
      : {
          title: "File browser and Drive plugin demo",
          description:
            "Preview a reusable React file browser with sample customer and project spaces, folders, uploads, rename, delete, and download controls.",
        };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: DrivePreview,
});
