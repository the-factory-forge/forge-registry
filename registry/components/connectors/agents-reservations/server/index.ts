import { z } from "zod";

import {
  agentRecord,
  agentVersion,
  agentTools,
  agentOperation,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { AgentsError } from "@/components/plugins/agents/types";
import {
  availabilitySchema,
  monthAvailabilitySchema,
  bookingSchema,
  moveSchema,
  rangeSchema,
  reservationListQuerySchema,
  settingsSchema,
  serviceSchema,
  resourceSchema,
} from "@/components/plugins/reservations/model";
import type { ReservationsAdminClient } from "@/components/plugins/reservations/types";

export interface ReservationsAgentOptions<Context> extends AgentConnectorOptions<
  Context,
  ReservationsAdminClient
> {
  /** Fresh authorized record lookup, excluding management secrets and signed URLs. */
  get(context: Context, id: string): Promise<unknown>;
}
export function createReservationsAgentOperation<Context>(
  options: ReservationsAgentOptions<Context>,
) {
  const { read, write } = agentTools<Context>();
  const before = (c: Context, i: { id: string }) => options.get(c, i.id);
  return agentOperation("reservations", "Reservations", options.authorize, [
    read("reservations_configuration", z.object({}), (c) => options.client(c).configuration()),
    read("reservations_list", rangeSchema, (c, i) => options.client(c).list(i)),
    read("reservations_list_page", reservationListQuerySchema, (c, i) =>
      options.client(c).listPage(i),
    ),
    read("reservations_get", agentRecord, before),
    read("reservations_availability", availabilitySchema, (c, i) =>
      options.client(c).availability(i),
    ),
    read("reservations_month_availability", monthAvailabilitySchema, (c, i) => {
      const client = options.client(c);
      if (!client.monthAvailability) throw new AgentsError("FORBIDDEN");
      return client.monthAvailability(i);
    }),
    write("reservations_book", bookingSchema.omit({ requestId: true }), {
      before: (c) => options.client(c).configuration(),
      run: (c, i, _f, requestId) => options.client(c).book({ ...i, requestId }),
      effects: ["Creates a reservation and its configured email notification."],
    }),
    write("reservations_reschedule", agentRecord.extend({ values: moveSchema }), {
      before,
      run: (c, i) => options.client(c).reschedule(i.id, i.values),
      effects: ["Moves the reservation and sends its configured notification."],
    }),
    write(
      "reservations_set_status",
      agentRecord.extend({
        version: agentVersion,
        status: z.enum(["pending", "confirmed", "rejected", "cancelled"]),
      }),
      {
        before,
        run: (c, i) => options.client(c).setStatus(i.id, i.version, i.status),
        effects: ["Changes booking status and sends its configured notification."],
      },
    ),
    write("reservations_save_settings", settingsSchema, {
      before: (c) => options.client(c).configuration(),
      run: (c, i) => options.client(c).saveSettings(i),
      effects: ["Changes booking configuration."],
    }),
    write("reservations_save_service", serviceSchema, {
      before: (c) => options.client(c).configuration(),
      run: (c, i) => options.client(c).saveService(i),
      effects: ["Changes service availability and booking policy."],
    }),
    write("reservations_save_resource", resourceSchema, {
      before: (c) => options.client(c).configuration(),
      run: (c, i) => options.client(c).saveResource(i),
      effects: ["Changes resource availability."],
    }),
    write("reservations_retry_email", agentRecord, {
      before,
      run: (c, i) => options.client(c).retryEmail(i.id),
      effects: ["Retries the configured reservation email."],
    }),
    write("reservations_revoke_link", agentRecord.extend({ version: agentVersion }), {
      before,
      run: (c, i) => options.client(c).revokeLink(i.id, i.version),
      effects: ["Invalidates the guest's current management link."],
    }),
  ]);
}
