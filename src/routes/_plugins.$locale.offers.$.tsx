import { createFileRoute } from "@tanstack/react-router";

import { OffersPreview } from "@/showroom/offers-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/_plugins/$locale/offers/$")({
  head: ({ match, params }) =>
    showroomHead({
      title: "Customer offers",
      description: "Prepare, issue and email customer offers with priced lines and printable PDFs.",
      path: match.pathname,
      noIndex: !!params._splat,
    }),
  component: OffersPreview,
});
