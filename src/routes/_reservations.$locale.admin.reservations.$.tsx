import { createFileRoute } from "@tanstack/react-router";

import type { ReservationFilters } from "@/components/plugins/reservations";
import { dateSchema, rangeSchema } from "@/components/plugins/reservations/model";
import { ReservationAdminPreview } from "@/showroom/reservations-preview";
import { showroomHead } from "@/showroom/seo";
export const Route = createFileRoute("/_reservations/$locale/admin/reservations/$")({
  validateSearch: (search): ReservationFilters & { date?: string } => ({
    date: dateSchema.optional().catch(undefined).parse(search.date),
    resourceId: rangeSchema.shape.resourceId.catch(undefined).parse(search.resourceId),
    serviceId: rangeSchema.shape.serviceId.catch(undefined).parse(search.serviceId),
    status: rangeSchema.shape.status.catch(undefined).parse(search.status),
  }),
  head: ({ params, match }) => {
    const [id, tab] = params._splat?.split("/").filter(Boolean) ?? [];
    const page =
      id === "new"
        ? {
            title: "New reservation demo",
            description:
              "Create a staff reservation on a dedicated page with service, resource, availability and guest details.",
          }
        : id === "settings" && tab
          ? {
              title: "Reservation service and resource editor demo",
              description:
                "Explore the React reservation editor for sample services and resources, with configurable schedules, booking limits, and preparation buffers.",
            }
          : id === "settings"
            ? {
                title: "Reservation settings demo",
                description:
                  "Preview React reservation settings for services, resources, working hours, availability, booking policies, and preparation and cleaning buffers.",
              }
            : {
                title: "Reservations calendar demo",
                description:
                  "Explore React reservation management with year and staff calendars, appointments, overnight stays, approvals, resources, and cleaning buffers.",
              };
    return showroomHead({
      ...page,
      path: match.pathname,
      noIndex: Boolean(id) || match.status !== "success",
    });
  },
  component: ReservationAdminPreview,
});
