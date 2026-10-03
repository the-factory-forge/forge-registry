import { createFileRoute } from "@tanstack/react-router";

import { ReservationPublicPreview } from "@/showroom/reservations-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/_reservations/$locale/reservations/$")({
  head: ({ params, match }) => {
    const [id] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "manage"
        ? {
            title: "Guest reservation management demo",
            description:
              "Preview the React guest reservation flow with sample booking details and host-controlled rescheduling and cancellation policies.",
          }
        : {
            title: "Appointments and overnight bookings demo",
            description:
              "Try the React reservations plugin with sample appointments and overnight stays, available slots, guest details, and booking confirmations.",
          };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: ReservationPublicPreview,
});
