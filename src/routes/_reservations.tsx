import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ReservationsPreviewProvider } from "@/showroom/reservations-preview";
export const Route = createFileRoute("/_reservations")({
  component: () => (
    <ReservationsPreviewProvider>
      <Outlet />
    </ReservationsPreviewProvider>
  ),
});
