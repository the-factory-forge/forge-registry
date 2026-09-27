import { createFileRoute } from "@tanstack/react-router";

import { ReservationAdminPreview } from "@/showroom/reservations-preview";
export const Route = createFileRoute("/_reservations/$locale/admin/reservations/$")({
  component: ReservationAdminPreview,
});
