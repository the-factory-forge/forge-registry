import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import {
  ReservationError,
  type Reservation,
  type ReservationAvailabilityQuery,
  type ReservationBookingInput,
  type ReservationConfiguration,
  type ReservationHours,
  type ReservationPolicy,
  type ReservationCommonPolicy,
  type ReservationMode,
  type ReservationMoveInput,
  type ReservationRange,
  type ReservationAdminRecord,
  type ReservationResource,
  type ReservationService,
  type ReservationSlot,
  type ReservationsAdminClient,
} from "@/components/plugins/reservations/types";

export const reservationPolicyDefaults = {
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  cancellationMinutes: 1440,
  approval: "automatic",
  noticeMinutes: 60,
  horizonDays: 90,
  intervalMinutes: 15,
} satisfies ReservationCommonPolicy;

const id = z.string().uuid();
const minutes = z.number().int().min(0).max(525600);
const commonPolicySchema = z.object({
  bufferBeforeMinutes: minutes.max(1440),
  bufferAfterMinutes: minutes.max(1440),
  cancellationMinutes: minutes,
  approval: z.enum(["automatic", "manual"]),
  noticeMinutes: minutes,
  horizonDays: z.number().int().min(1).max(365),
  intervalMinutes: z.number().int().min(1).max(1440),
});
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const appointmentPolicySchema = commonPolicySchema.extend({
  mode: z.literal("appointment").default("appointment"),
  durationMinutes: z.number().int().min(1).max(1440),
});
const stayPolicySchema = commonPolicySchema
  .extend({
    mode: z.literal("stay"),
    arrivalStart: time,
    arrivalEnd: time,
    checkoutTime: time,
    minNights: z.number().int().min(1).max(365),
    maxNights: z.number().int().min(1).max(365),
  })
  .refine((v) => v.arrivalStart < v.arrivalEnd && v.minNights <= v.maxNights);
export const policySchema = z.union([appointmentPolicySchema, stayPolicySchema]);
const serviceFields = {
  id,
  version: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  resourceIds: z.array(id).max(100),
  active: z.boolean(),
  archived: z.boolean(),
};
export const serviceSchema = z
  .union([
    appointmentPolicySchema.extend(serviceFields),
    stayPolicySchema.safeExtend(serviceFields),
  ])
  .refine((v) => new Set(v.resourceIds).size === v.resourceIds.length);
export const reservationStayPolicyDefaults = {
  ...reservationPolicyDefaults,
  mode: "stay" as const,
  minNights: 1,
  maxNights: 30,
};
const hours = z
  .array(z.object({ start: time, end: z.union([time, z.literal("24:00")]) }))
  .max(12)
  .refine((v) => {
    const sorted = [...v].sort((a, b) => a.start.localeCompare(b.start));
    return sorted.every((h, i) => h.start < h.end && (!i || sorted[i - 1].end <= h.start));
  });
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      return Temporal.PlainDate.from(value).toString() === value;
    } catch {
      return false;
    }
  });
export const resourceSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120),
  active: z.boolean(),
  archived: z.boolean(),
  weeklyHours: z.record(z.string().regex(/^[1-7]$/), hours),
  exceptions: z.record(dateSchema, hours).refine((v) => Object.keys(v).length <= 730),
  blockedDates: z
    .array(z.object({ from: dateSchema, through: dateSchema }).refine((v) => v.from <= v.through))
    .max(730)
    .optional(),
});
export const settingsSchema = z.object({
  version: z.number().int().nonnegative(),
  publicBookingEnabled: z.boolean(),
  timeZone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return !/^[+-]/.test(value);
      } catch {
        return false;
      }
    }),
});
export const instantSchema = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v).toISOString());
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(40),
});
export const bookingSchema = z.object({
  requestId: id,
  serviceId: id,
  resourceId: id.optional(),
  startsAt: instantSchema,
  departureDate: dateSchema.optional(),
  customer: customerSchema,
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/)
    .max(35)
    .refine((value) => {
      try {
        return Intl.getCanonicalLocales(value).length === 1;
      } catch {
        return false;
      }
    }),
});
export const availabilitySchema = z.object({
  serviceId: id,
  resourceId: id.optional(),
  date: dateSchema,
  departureDate: dateSchema.optional(),
});
export const moveSchema = z.object({
  version: z.number().int().positive(),
  startsAt: instantSchema,
  departureDate: dateSchema.optional(),
  resourceId: id.optional(),
});
export const rangeSchema = z
  .object({
    from: instantSchema,
    to: instantSchema,
    resourceId: id.optional(),
    serviceId: id.optional(),
    status: z.enum(["pending", "confirmed", "cancelled", "rejected"]).optional(),
  })
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 43 * 86400000,
  );

/** Keep the server's bounded list contract when displaying a whole year. */
export async function loadReservationCalendar(
  client: Pick<ReservationsAdminClient, "list">,
  range: ReservationRange,
): Promise<ReservationAdminRecord[]> {
  const from = Date.parse(range.from),
    to = Date.parse(range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 367 * 86400000)
    throw new ReservationError("INVALID");
  if (to - from <= 43 * 86400000) return client.list(range);
  const queries: ReservationRange[] = [];
  for (let start = from; start < to; start += 42 * 86400000) {
    queries.push({
      ...range,
      from: new Date(start).toISOString(),
      to: new Date(Math.min(start + 42 * 86400000, to)).toISOString(),
    });
  }
  const pages = await Promise.all(queries.map((query) => client.list(query)));
  const unique = new Map<string, ReservationAdminRecord>();
  for (const reservation of pages.flat()) {
    if ((unique.get(reservation.id)?.version ?? 0) < reservation.version)
      unique.set(reservation.id, reservation);
  }
  return [...unique.values()];
}

export function parseReservationInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ReservationError("INVALID");
  return result.data;
}
export const parseReservationId = (input: unknown) => parseReservationInput(id, input);
export const activeReservation = (r: Reservation) =>
  r.status === "pending" || r.status === "confirmed";
export const overlaps = (a: string, b: string, c: string, d: string) => a < d && c < b;
export const addMinutes = (iso: string, value: number) =>
  new Date(Date.parse(iso) + value * 60000).toISOString();
export const localDate = (iso: string, zone: string) =>
  Temporal.Instant.from(iso).toZonedDateTimeISO(zone).toPlainDate().toString();

export function hoursFor(resource: ReservationResource, date: string): ReservationHours[] {
  return (
    resource.exceptions[date] ??
    resource.weeklyHours[String(Temporal.PlainDate.from(date).dayOfWeek)] ??
    []
  );
}

/** Return both occurrences of repeated wall times, and none for nonexistent times. */
function wallInstants(date: string, time: string, zone: string): string[] {
  const day = Temporal.PlainDate.from(date);
  const plain =
    time === "24:00" ? day.add({ days: 1 }).toPlainDateTime("00:00") : day.toPlainDateTime(time);
  const values = ["earlier", "later"] as const;
  return [
    ...new Set(
      values.flatMap((disambiguation) => {
        const zoned = plain.toZonedDateTime(zone, { disambiguation });
        return zoned.toPlainDateTime().equals(plain)
          ? [new Date(Number(zoned.epochMilliseconds)).toISOString()]
          : [];
      }),
    ),
  ];
}

function workingWindows(resource: ReservationResource, date: string, zone: string) {
  return hoursFor(resource, date).flatMap((h) => {
    // Schedule boundaries in a DST gap close that interval rather than silently moving it.
    const starts = wallInstants(date, h.start, zone).sort();
    const ends = wallInstants(date, h.end, zone).sort();
    return starts.length && ends.length ? [{ start: starts[0], end: ends[ends.length - 1] }] : [];
  });
}

export function fitsHours(
  resource: ReservationResource,
  start: string,
  end: string,
  zone: string,
): boolean {
  return workingWindows(resource, localDate(start, zone), zone).some(
    (w) => start >= w.start && end <= w.end,
  );
}

export function stayNights(arrival: string, departure: string): number {
  return Temporal.PlainDate.from(arrival).until(Temporal.PlainDate.from(departure)).days;
}

export function fitsResource(
  resource: ReservationResource,
  start: string,
  end: string,
  zone: string,
  mode: ReservationMode = "appointment",
): boolean {
  if (mode === "appointment") return fitsHours(resource, start, end, zone);
  return !(resource.blockedDates ?? []).some((block) => {
    const from = Temporal.PlainDate.from(block.from)
      .toZonedDateTime(zone)
      .toInstant()
      .toString({ fractionalSecondDigits: 3 });
    const to = Temporal.PlainDate.from(block.through)
      .add({ days: 1 })
      .toZonedDateTime(zone)
      .toInstant()
      .toString({ fractionalSecondDigits: 3 });
    return overlaps(start, end, from, to);
  });
}

function reservationEnd(
  policy: ReservationPolicy,
  start: string,
  departure: string | undefined,
  zone: string,
) {
  if (policy.mode !== "stay") {
    if (departure !== undefined) throw new ReservationError("INVALID");
    return addMinutes(start, policy.durationMinutes);
  }
  if (!departure || !dateSchema.safeParse(departure).success) throw new ReservationError("INVALID");
  const nights = stayNights(localDate(start, zone), departure);
  if (nights < policy.minNights || nights > policy.maxNights) throw new ReservationError("INVALID");
  return wallInstants(departure, policy.checkoutTime, zone).sort().at(-1);
}

export function canCustomerChange(reservation: Reservation, now: string) {
  return (
    activeReservation(reservation) &&
    now < reservation.cancellationDeadline &&
    now < reservation.startsAt
  );
}

export function catalog(configuration: ReservationConfiguration) {
  const resources = configuration.resources.filter((r) => r.active && !r.archived);
  const services = configuration.services
    .filter((s) => s.active && !s.archived)
    .map((s) => ({
      ...s,
      resourceIds: s.resourceIds.filter((id) => resources.some((r) => r.id === id)),
    }));
  return {
    mode: configuration.mode ?? "appointment",
    settings: configuration.settings,
    services,
    resources: resources.map(({ id, name }) => ({ id, name })),
  };
}

export function findService(
  configuration: ReservationConfiguration,
  id: string,
): ReservationService {
  const service = configuration.services.find((s) => s.id === id);
  if (!service) throw new ReservationError("NOT_FOUND");
  return service;
}

export function availableSlots(
  configuration: ReservationConfiguration,
  reservations: Reservation[],
  query: ReservationAvailabilityQuery,
  now: string,
  options: { staff?: boolean; reservation?: Reservation } = {},
): ReservationSlot[] {
  const { settings } = configuration;
  if (!options.staff && !options.reservation && !settings.publicBookingEnabled) return [];
  const service = findService(configuration, query.serviceId);
  if (!service.active || service.archived) return [];
  const policy = options.reservation?.policy ?? service;
  if ((policy.mode ?? "appointment") !== (configuration.mode ?? "appointment"))
    throw new ReservationError("MODE_MISMATCH");
  const zone = settings.timeZone;
  const date = Temporal.PlainDate.from(query.date);
  const earliest = options.staff ? now : addMinutes(now, policy.noticeMinutes);
  const lastDate = Temporal.PlainDate.from(localDate(now, zone))
    .add({ days: policy.horizonDays })
    .toString();
  if (query.date > lastDate || query.date < localDate(now, zone)) return [];
  if (policy.mode === "stay") {
    if (!query.departureDate || !dateSchema.safeParse(query.departureDate).success)
      throw new ReservationError("INVALID");
    const nights = stayNights(query.date, query.departureDate);
    if (nights < policy.minNights || nights > policy.maxNights)
      throw new ReservationError("INVALID");
  } else if (query.departureDate !== undefined) throw new ReservationError("INVALID");
  const resources = configuration.resources.filter(
    (r) =>
      r.active &&
      !r.archived &&
      service.resourceIds.includes(r.id) &&
      (!query.resourceId || query.resourceId === r.id),
  );
  const slots = new Map<string, ReservationSlot>();
  for (const resource of resources) {
    for (const h of policy.mode === "stay"
      ? [{ start: policy.arrivalStart, end: policy.arrivalEnd }]
      : hoursFor(resource, query.date)) {
      const [hour, minute] = h.start.split(":").map(Number);
      const [endHour, endMinute] = h.end.split(":").map(Number);
      for (
        let offset = hour * 60 + minute;
        offset < endHour * 60 + endMinute;
        offset += policy.intervalMinutes
      ) {
        const time = `${String(Math.floor(offset / 60)).padStart(2, "0")}:${String(offset % 60).padStart(2, "0")}`;
        for (const start of wallInstants(date.toString(), time, zone)) {
          const end = reservationEnd(policy, start, query.departureDate, zone);
          if (!end) continue;
          const occupiedStart = addMinutes(start, -policy.bufferBeforeMinutes);
          const occupiedEnd = addMinutes(end, policy.bufferAfterMinutes);
          if (
            start < earliest ||
            start <= now ||
            !fitsResource(resource, occupiedStart, occupiedEnd, zone, policy.mode)
          )
            continue;
          if (
            reservations.some(
              (r) =>
                r.id !== options.reservation?.id &&
                r.resourceId === resource.id &&
                activeReservation(r) &&
                overlaps(occupiedStart, occupiedEnd, r.occupiedStart, r.occupiedEnd),
            )
          )
            continue;
          slots.set(start, { startsAt: start, endsAt: end });
        }
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function placeReservation(
  configuration: ReservationConfiguration,
  reservations: Reservation[],
  input: ReservationBookingInput,
  now: string,
  id: string,
  options: { staff?: boolean; reservation?: Reservation } = {},
): Reservation {
  if (!options.staff && !options.reservation && !configuration.settings.publicBookingEnabled)
    throw new ReservationError("CLOSED");
  const service = findService(configuration, input.serviceId);
  const policy = options.reservation?.policy ?? parseReservationInput(policySchema, service);
  const zone = configuration.settings.timeZone;
  const date = localDate(input.startsAt, zone);
  const resource = [...configuration.resources]
    .sort((a, b) => a.id.localeCompare(b.id))
    .find(
      (r) =>
        (!input.resourceId || input.resourceId === r.id) &&
        availableSlots(
          configuration,
          reservations,
          { serviceId: service.id, resourceId: r.id, date, departureDate: input.departureDate },
          now,
          options,
        ).some((slot) => slot.startsAt === input.startsAt),
    );
  if (!resource) throw new ReservationError("CONFLICT");
  const end = reservationEnd(policy, input.startsAt, input.departureDate, zone);
  if (!end) throw new ReservationError("CONFLICT");
  return {
    mode: policy.mode ?? "appointment",
    ...(policy.mode === "stay"
      ? { departureDate: input.departureDate, nights: stayNights(date, input.departureDate!) }
      : {}),
    id,
    version: (options.reservation?.version ?? 0) + 1,
    serviceId: service.id,
    serviceName: options.reservation?.serviceName ?? service.name,
    resourceId: resource.id,
    resourceName: resource.name,
    status: policy.approval === "manual" ? "pending" : "confirmed",
    startsAt: input.startsAt,
    endsAt: end,
    occupiedStart: addMinutes(input.startsAt, -policy.bufferBeforeMinutes),
    occupiedEnd: addMinutes(end, policy.bufferAfterMinutes),
    cancellationDeadline: addMinutes(input.startsAt, -policy.cancellationMinutes),
    timeZone: zone,
    policy,
    customer: input.customer,
    locale: input.locale,
    createdAt: options.reservation?.createdAt ?? now,
    updatedAt: now,
  };
}

export function assertVersion(actual: number, expected: number) {
  if (!Number.isInteger(expected) || actual !== expected) throw new ReservationError("CONFLICT");
}

export function changeStatus(
  reservation: Reservation,
  status: Reservation["status"],
  now: string,
): Reservation {
  if (
    !activeReservation(reservation) ||
    status === "pending" ||
    (status === "confirmed" && (reservation.status !== "pending" || reservation.startsAt <= now)) ||
    (status === "rejected" && reservation.status !== "pending")
  )
    throw new ReservationError("CONFLICT");
  return { ...reservation, status, version: reservation.version + 1, updatedAt: now };
}

export function assertResourceExceptions(
  previous: ReservationResource | undefined,
  next: ReservationResource,
  reservations: Reservation[],
  timeZone: string,
) {
  for (const r of reservations.filter((r) => r.resourceId === next.id && activeReservation(r))) {
    if (r.mode === "stay") {
      if (
        JSON.stringify(next.blockedDates) !== JSON.stringify(previous?.blockedDates) &&
        !fitsResource(next, r.occupiedStart, r.occupiedEnd, timeZone, "stay")
      )
        throw new ReservationError("CONFLICT");
      continue;
    }
    const date = localDate(r.occupiedStart, timeZone);
    if (
      next.exceptions[date] !== undefined &&
      JSON.stringify(next.exceptions[date]) !== JSON.stringify(previous?.exceptions[date]) &&
      !fitsHours(next, r.occupiedStart, r.occupiedEnd, timeZone)
    )
      throw new ReservationError("CONFLICT");
  }
}

/** Preview a selected server-provided slot; the mutation response remains authoritative. */
export function previewReservationMove(
  reservation: Reservation,
  input: ReservationMoveInput,
  slot: ReservationSlot,
  timeZone: string,
  resourceName: string,
): Reservation {
  return {
    ...reservation,
    ...slot,
    timeZone,
    resourceId: input.resourceId ?? "",
    resourceName,
    status: reservation.policy.approval === "manual" ? "pending" : "confirmed",
    occupiedStart: addMinutes(slot.startsAt, -reservation.policy.bufferBeforeMinutes),
    occupiedEnd: addMinutes(slot.endsAt, reservation.policy.bufferAfterMinutes),
    cancellationDeadline: addMinutes(slot.startsAt, -reservation.policy.cancellationMinutes),
    ...(reservation.mode === "stay"
      ? {
          departureDate: input.departureDate,
          nights: stayNights(localDate(slot.startsAt, timeZone), localDate(slot.endsAt, timeZone)),
        }
      : {}),
  };
}
