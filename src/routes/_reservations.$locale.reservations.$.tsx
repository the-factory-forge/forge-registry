import { createFileRoute } from "@tanstack/react-router";

import { ReservationPublicPreview } from "@/showroom/reservations-preview";
export const Route = createFileRoute("/_reservations/$locale/reservations/$")({
  component: ReservationPublicPreview,
});
