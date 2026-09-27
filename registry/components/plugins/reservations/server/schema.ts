import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import type {
  Reservation,
  ReservationResource,
  ReservationService,
  ReservationSettings,
  ReservationMode,
} from "@/components/plugins/reservations/types";

export const reservationSettings = pgTable(
  "reservations_settings",
  {
    id: text("id").primaryKey(),
    document: jsonb("document").$type<ReservationSettings & { mode?: ReservationMode }>().notNull(),
  },
  (t) => [check("reservations_settings_id_check", sql`${t.id} = 'business'`)],
);
export const reservationResources = pgTable("reservations_resource", {
  id: text("id").primaryKey(),
  document: jsonb("document").$type<ReservationResource>().notNull(),
});
export const reservationServices = pgTable("reservations_service", {
  id: text("id").primaryKey(),
  document: jsonb("document").$type<ReservationService>().notNull(),
});
export const reservations = pgTable(
  "reservations_booking",
  {
    id: text("id").primaryKey(),
    document: jsonb("document").$type<Reservation>().notNull(),
    requestId: text("request_id").notNull().unique(),
    requestHash: text("request_hash").notNull(),
    tokenVersion: integer("token_version").notNull().default(1),
    resourceId: text("resource_id")
      .notNull()
      .references(() => reservationResources.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => reservationServices.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    occupiedEnd: timestamp("occupied_end", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("reservations_booking_check", sql`${t.occupiedEnd} > ${t.startsAt}`),
    index("reservations_booking_range").on(t.startsAt, t.occupiedEnd),
    index("reservations_booking_resource").on(t.resourceId),
  ],
);

export const reservationNotifications = pgTable(
  "reservations_notification",
  {
    id: text("id").primaryKey(),
    reservationId: text("reservation_id")
      .notNull()
      .references(() => reservations.id),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    document: jsonb("document").$type<Reservation>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttempt: timestamp("next_attempt", { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseId: text("lease_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    unique("reservations_notification_reservation_id_version_key").on(t.reservationId, t.version),
    index("reservations_notification_due").on(t.sentAt, t.nextAttempt),
  ],
);
