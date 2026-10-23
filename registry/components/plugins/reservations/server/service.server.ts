import { createHash, randomUUID } from "node:crypto";

import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notExists,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { renderEmail } from "@/components/plugins/mailing";
import {
  activeReservation,
  assertResourceExceptions,
  assertVersion,
  availableSlots,
  availabilitySchema,
  bookingSchema,
  canCustomerChange,
  catalog,
  changeStatus,
  fitsResource,
  moveSchema,
  parseReservationId,
  parseReservationInput,
  placeReservation,
  rangeSchema,
  resourceSchema,
  serviceSchema,
  settingsSchema,
} from "@/components/plugins/reservations/model";
import {
  signManagementLink,
  verifyManagementLink,
} from "@/components/plugins/reservations/server/links";
import {
  reservations as bookings,
  reservationNotifications as notifications,
  reservationSettings as settingsTable,
  reservationResources as resourceTable,
  reservationServices as serviceTable,
} from "@/components/plugins/reservations/server/schema";
import {
  ReservationError,
  type Reservation,
  type ReservationBookingInput,
  type ReservationConfiguration,
  type ReservationManagementClient,
  type ReservationMode,
  type ReservationsAdminClient,
  type ReservationsPublicClient,
} from "@/components/plugins/reservations/types";
import {
  lockPlugin,
  type PluginDatabase,
  type DatabaseTransaction,
} from "@/components/utils/database";

export type ReservationsTransaction = DatabaseTransaction;
export type ReservationsDatabase = PluginDatabase;
export type ReservationEmailKind =
  | "booked"
  | "rescheduled"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "link";
export interface ReservationEmail {
  id: string;
  kind: ReservationEmailKind;
  to: string;
  locale: string;
  reservation: Reservation;
  managementUrl: string;
  subject: string;
  text: string;
  html?: string;
}
export interface ReservationsServiceOptions<Context> {
  mode: ReservationMode;
  db: ReservationsDatabase;
  /** Read the host's fresh server session, never a role submitted by the browser. */
  authorize(context: Context, action: "read" | "manage" | "settings"): Promise<boolean>;
  /** Use email.id as the provider idempotency key. Throw when delivery fails. */
  sendEmail(email: ReservationEmail): Promise<void>;
  managementSecret: string;
  getManagementUrl(token: string): string;
  /** Override content for host branding/translations. */
  formatEmail?: (
    email: ReservationEmail,
  ) =>
    | Pick<ReservationEmail, "subject" | "text" | "html">
    | Promise<Pick<ReservationEmail, "subject" | "text" | "html">>;
  now?: () => Date;
}

type BookingRow = Pick<typeof bookings.$inferSelect, "document" | "tokenVersion">;
const older = alias(notifications, "older");

export function createReservationsService<Context>(options: ReservationsServiceOptions<Context>) {
  const { db, managementSecret, mode } = options;
  if (mode !== "appointment" && mode !== "stay") throw new ReservationError("INVALID");
  if (Buffer.byteLength(managementSecret) < 32) throw new ReservationError("INVALID");
  const now = () => (options.now?.() ?? new Date()).toISOString();
  async function safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ReservationError) throw error;
      throw new ReservationError("STORAGE");
    }
  }
  async function permit(context: Context, action: "read" | "manage" | "settings") {
    if (!(await options.authorize(context, action))) throw new ReservationError("FORBIDDEN");
  }
  function mutate<T>(action: (tx: ReservationsTransaction) => Promise<T>) {
    return safe(() =>
      db.transaction(async (tx) => {
        // shortcut: one scheduling writer per business/database; switch to ordered resource
        // locks when measured write throughput warrants the additional locking protocol.
        await lockPlugin(tx, "forge-reservations");
        await installationMode(tx, true);
        return action(tx);
      }),
    );
  }
  async function installationMode(tx: ReservationsTransaction, initialize = false) {
    const [row] = await tx
      .select({ document: settingsTable.document })
      .from(settingsTable)
      .where(eq(settingsTable.id, "business"));
    const legacy = row
      ? false
      : Boolean(
          (await tx.select({ id: resourceTable.id }).from(resourceTable).limit(1)).length ||
          (await tx.select({ id: serviceTable.id }).from(serviceTable).limit(1)).length ||
          (await tx.select({ id: bookings.id }).from(bookings).limit(1)).length,
        );
    const saved = row ? (row.document.mode ?? "appointment") : legacy ? "appointment" : undefined;
    if (saved && saved !== mode) throw new ReservationError("MODE_MISMATCH");
    if (initialize && !row?.document.mode) {
      const document = {
        ...(row?.document ?? { version: 0, timeZone: "UTC", publicBookingEnabled: false }),
        mode,
      };
      await tx
        .insert(settingsTable)
        .values({ id: "business", document: document })
        .onConflictDoUpdate({ target: settingsTable.id, set: { document: document } });
    }
  }
  async function configuration(tx: ReservationsTransaction): Promise<ReservationConfiguration> {
    await installationMode(tx);
    const [settings] = await tx
      .select({ document: settingsTable.document })
      .from(settingsTable)
      .where(eq(settingsTable.id, "business"));
    const services = await tx
      .select({ document: serviceTable.document })
      .from(serviceTable)
      .orderBy(serviceTable.id);
    const resources = await tx
      .select({ document: resourceTable.document })
      .from(resourceTable)
      .orderBy(resourceTable.id);
    return {
      mode,
      settings: parseReservationInput(
        settingsSchema,
        settings?.document ?? { version: 0, timeZone: "UTC", publicBookingEnabled: false },
      ),
      services: services.map((r) => r.document),
      resources: resources.map((r) => r.document),
    };
  }
  async function occupied(tx: ReservationsTransaction, at: string) {
    // A new appointment's preparation can overlap an appointment that just ended.
    // One day covers the maximum allowed preparation buffer.
    return (
      await tx
        .select({ document: bookings.document })
        .from(bookings)
        .where(
          and(
            gt(bookings.occupiedEnd, new Date(Date.parse(at) - 86400000)),
            inArray(bookings.status, ["pending", "confirmed"]),
          ),
        )
    ).map((r) => r.document);
  }
  async function booking(tx: ReservationsTransaction, id: string): Promise<BookingRow> {
    parseReservationId(id);
    const [row] = await tx
      .select({ document: bookings.document, tokenVersion: bookings.tokenVersion })
      .from(bookings)
      .where(eq(bookings.id, id));
    if (!row) throw new ReservationError("NOT_FOUND");
    return { ...row, document: { ...row.document, mode: row.document.mode ?? "appointment" } };
  }
  async function linked(tx: ReservationsTransaction, token: string): Promise<BookingRow> {
    const claim = verifyManagementLink(token, managementSecret, Date.parse(now()));
    const rows = await tx
      .select({ document: bookings.document, tokenVersion: bookings.tokenVersion })
      .from(bookings)
      .where(eq(bookings.id, claim.id));
    if (!rows[0] || rows[0].tokenVersion !== claim.version)
      throw new ReservationError("INVALID_LINK");
    return {
      ...rows[0],
      document: { ...rows[0].document, mode: rows[0].document.mode ?? "appointment" },
    };
  }
  async function enqueue(
    tx: ReservationsTransaction,
    reservation: Reservation,
    kind: ReservationEmailKind,
  ) {
    await tx.insert(notifications).values({
      id: randomUUID(),
      reservationId: reservation.id,
      version: reservation.version,
      kind,
      document: reservation,
      nextAttempt: new Date(now()),
    });
  }
  async function update(
    tx: ReservationsTransaction,
    reservation: Reservation,
    kind: ReservationEmailKind,
  ) {
    await tx
      .update(bookings)
      .set({
        document: reservation,
        resourceId: reservation.resourceId,
        startsAt: new Date(reservation.startsAt),
        occupiedEnd: new Date(reservation.occupiedEnd),
      })
      .where(eq(bookings.id, reservation.id));
    await enqueue(tx, reservation, kind);
    return reservation;
  }
  async function create(input: ReservationBookingInput, staff: boolean): Promise<Reservation> {
    const value = parseReservationInput(bookingSchema, input);
    const requestId = `${staff ? "staff" : "public"}:${value.requestId}`;
    const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    return mutate(async (tx) => {
      const [existing] = await tx
        .select({ document: bookings.document, requestHash: bookings.requestHash })
        .from(bookings)
        .where(eq(bookings.requestId, requestId));
      if (existing) {
        if (existing.requestHash !== hash) throw new ReservationError("CONFLICT");
        return { ...existing.document, mode: existing.document.mode ?? "appointment" };
      }
      const at = now();
      const reservation = placeReservation(
        await configuration(tx),
        await occupied(tx, at),
        value,
        at,
        randomUUID(),
        { staff },
      );
      await tx.insert(bookings).values({
        id: reservation.id,
        document: reservation,
        requestId,
        requestHash: hash,
        resourceId: reservation.resourceId,
        serviceId: reservation.serviceId,
        startsAt: new Date(reservation.startsAt),
        occupiedEnd: new Date(reservation.occupiedEnd),
      });
      await enqueue(tx, reservation, "booked");
      return reservation;
    });
  }
  async function move(
    tx: ReservationsTransaction,
    current: Reservation,
    input: Parameters<ReservationManagementClient["reschedule"]>[0],
    staff: boolean,
  ) {
    const value = parseReservationInput(moveSchema, input);
    assertVersion(current.version, value.version);
    if (!activeReservation(current)) throw new ReservationError("CONFLICT");
    if (!staff && !canCustomerChange(current, now())) throw new ReservationError("CUTOFF");
    const at = now();
    const next = placeReservation(
      await configuration(tx),
      await occupied(tx, at),
      {
        requestId: randomUUID(),
        serviceId: current.serviceId,
        startsAt: value.startsAt,
        departureDate: value.departureDate,
        resourceId: value.resourceId,
        customer: current.customer,
        locale: current.locale,
      },
      at,
      current.id,
      { staff, reservation: current },
    );
    return update(tx, next, "rescheduled");
  }

  const publicClient: ReservationsPublicClient = {
    catalog: () => safe(async () => catalog(await configuration(db))),
    availability: (input) =>
      safe(async () => {
        const query = parseReservationInput(availabilitySchema, input);
        return availableSlots(await configuration(db), await occupied(db, now()), query, now());
      }),
    book: (input) => safe(() => create(input, false)),
  };

  function managementClient(token: string): ReservationManagementClient {
    return {
      get: () =>
        safe(async () => {
          const { document: reservation } = await linked(db, token);
          const config = await configuration(db);
          const service = config.services.find((s) => s.id === reservation.serviceId);
          return {
            reservation,
            timeZone: config.settings.timeZone,
            canChange: canCustomerChange(reservation, now()),
            resources: config.resources
              .filter((r) => r.active && !r.archived && service?.resourceIds.includes(r.id))
              .map(({ id, name }) => ({ id, name })),
          };
        }),
      availability: (input) =>
        safe(async () => {
          const { document: reservation } = await linked(db, token);
          if (!canCustomerChange(reservation, now())) throw new ReservationError("CUTOFF");
          const query = parseReservationInput(availabilitySchema, {
            ...input,
            serviceId: reservation.serviceId,
          });
          return availableSlots(await configuration(db), await occupied(db, now()), query, now(), {
            reservation,
          });
        }),
      cancel: (version) =>
        mutate(async (tx) => {
          const { document: current } = await linked(tx, token);
          assertVersion(current.version, version);
          if (!canCustomerChange(current, now())) throw new ReservationError("CUTOFF");
          return update(tx, changeStatus(current, "cancelled", now()), "cancelled");
        }),
      reschedule: (input) =>
        mutate(async (tx) => move(tx, (await linked(tx, token)).document, input, false)),
    };
  }

  function adminClient(context: Context): ReservationsAdminClient {
    const read = <T>(fn: () => Promise<T>) =>
      safe(async () => {
        await permit(context, "read");
        return fn();
      });
    const write = <T>(
      action: "manage" | "settings",
      fn: (tx: ReservationsTransaction) => Promise<T>,
    ) =>
      safe(async () => {
        await permit(context, action);
        return mutate(fn);
      });
    return {
      configuration: () => read(() => configuration(db)),
      list: (input) =>
        read(async () => {
          const range = parseReservationInput(rangeSchema, input);
          const config = await configuration(db);
          const rows = await db
            .select({
              document: bookings.document,
              emailFailed: exists(
                db
                  .select({ id: notifications.id })
                  .from(notifications)
                  .where(
                    and(
                      eq(notifications.reservationId, bookings.id),
                      isNull(notifications.sentAt),
                      isNotNull(notifications.error),
                    ),
                  ),
              ).mapWith(Boolean),
            })
            .from(bookings)
            .where(
              and(
                lt(bookings.startsAt, new Date(range.to)),
                gt(bookings.occupiedEnd, new Date(range.from)),
              ),
            )
            .orderBy(bookings.startsAt, bookings.id);
          return rows
            .filter(
              ({ document: r }) =>
                (!range.resourceId || r.resourceId === range.resourceId) &&
                (!range.serviceId || r.serviceId === range.serviceId) &&
                (!range.status || r.status === range.status),
            )
            .map(({ document: r, emailFailed }) => {
              const resource = config.resources.find((value) => value.id === r.resourceId);
              return {
                ...r,
                mode: r.mode ?? "appointment",
                emailFailed: emailFailed,
                outsideHours:
                  activeReservation(r) &&
                  (!resource ||
                    !fitsResource(
                      resource,
                      r.occupiedStart,
                      r.occupiedEnd,
                      config.settings.timeZone,
                      r.mode,
                    )),
              };
            });
        }),
      availability: (input) =>
        read(async () => {
          const query = parseReservationInput(availabilitySchema, input);
          const reservation = input.reservationId
            ? (await booking(db, input.reservationId)).document
            : undefined;
          if (reservation && reservation.serviceId !== query.serviceId)
            throw new ReservationError("INVALID");
          return availableSlots(await configuration(db), await occupied(db, now()), query, now(), {
            staff: true,
            reservation,
          });
        }),
      book: (input) =>
        safe(async () => {
          await permit(context, "manage");
          return create(input, true);
        }),
      reschedule: (id, input) =>
        write("manage", async (tx) => move(tx, (await booking(tx, id)).document, input, true)),
      setStatus: (id, version, status) =>
        write("manage", async (tx) => {
          if (!["confirmed", "rejected", "cancelled"].includes(status))
            throw new ReservationError("INVALID");
          const { document: current } = await booking(tx, id);
          assertVersion(current.version, version);
          return update(
            tx,
            changeStatus(current, status, now()),
            status as "confirmed" | "rejected" | "cancelled",
          );
        }),
      saveSettings: (input) =>
        write("settings", async (tx) => {
          const value = parseReservationInput(settingsSchema, input);
          assertVersion((await configuration(tx)).settings.version, value.version);
          const next = { ...value, mode, version: value.version + 1 };
          await tx
            .insert(settingsTable)
            .values({ id: "business", document: next })
            .onConflictDoUpdate({ target: settingsTable.id, set: { document: next } });
          return next;
        }),
      saveService: (input) =>
        write("settings", async (tx) => {
          const value = parseReservationInput(serviceSchema, input);
          if ((value.mode ?? "appointment") !== mode) throw new ReservationError("MODE_MISMATCH");
          const config = await configuration(tx);
          assertVersion(
            config.services.find((s) => s.id === value.id)?.version ?? 0,
            value.version,
          );
          if (value.resourceIds.some((id) => !config.resources.some((r) => r.id === id)))
            throw new ReservationError("INVALID");
          const next = {
            ...value,
            version: value.version + 1,
            active: value.archived ? false : value.active,
          };
          await tx
            .insert(serviceTable)
            .values({ id: next.id, document: next })
            .onConflictDoUpdate({ target: serviceTable.id, set: { document: next } });
          return next;
        }),
      saveResource: (input) =>
        write("settings", async (tx) => {
          const value = parseReservationInput(resourceSchema, input);
          if (mode === "appointment" && value.blockedDates?.length)
            throw new ReservationError("INVALID");
          if (
            mode === "stay" &&
            (Object.keys(value.weeklyHours).length || Object.keys(value.exceptions).length)
          )
            throw new ReservationError("INVALID");
          const config = await configuration(tx);
          const previous = config.resources.find((r) => r.id === value.id);
          assertVersion(previous?.version ?? 0, value.version);
          assertResourceExceptions(
            previous,
            value,
            await occupied(tx, now()),
            config.settings.timeZone,
          );
          const next = {
            ...value,
            version: value.version + 1,
            active: value.archived ? false : value.active,
          };
          await tx
            .insert(resourceTable)
            .values({ id: next.id, document: next })
            .onConflictDoUpdate({ target: resourceTable.id, set: { document: next } });
          return next;
        }),
      retryEmail: (id) =>
        write("manage", async (tx) => {
          await booking(tx, id);
          await tx
            .update(notifications)
            .set({ nextAttempt: new Date(now()) })
            .where(and(eq(notifications.reservationId, id), isNull(notifications.sentAt)));
        }),
      revokeLink: (id, version) =>
        write("manage", async (tx) => {
          const { document: current, tokenVersion } = await booking(tx, id);
          assertVersion(current.version, version);
          await tx
            .update(bookings)
            .set({ tokenVersion: tokenVersion + 1 })
            .where(eq(bookings.id, id));
          return update(tx, { ...current, version: current.version + 1, updatedAt: now() }, "link");
        }),
    };
  }

  /** Server-only worker. Invoke after mutations and from a host scheduler for retries. */
  async function deliverNotifications(limit = 20): Promise<{ sent: number; failed: number }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ReservationError("INVALID");
    let sent = 0,
      failed = 0;
    for (let i = 0; i < limit; i++) {
      const leaseId = randomUUID();
      const job = await mutate(async (tx) => {
        const [next] = await tx
          .select()
          .from(notifications)
          .where(
            and(
              isNull(notifications.sentAt),
              lte(notifications.nextAttempt, new Date(now())),
              or(isNull(notifications.leaseUntil), lte(notifications.leaseUntil, new Date(now()))),
              notExists(
                tx
                  .select({ id: older.id })
                  .from(older)
                  .where(
                    and(
                      eq(older.reservationId, notifications.reservationId),
                      lt(older.version, notifications.version),
                      isNull(older.sentAt),
                    ),
                  ),
              ),
            ),
          )
          .orderBy(notifications.nextAttempt, notifications.id)
          .limit(1);
        if (!next) return undefined;
        await tx
          .update(notifications)
          .set({
            leaseId,
            leaseUntil: new Date(Date.parse(now()) + 300000),
            attempts: next.attempts + 1,
          })
          .where(eq(notifications.id, next.id));
        return next;
      });
      if (!job) break;
      try {
        const current = await booking(db, job.reservationId);
        const expiry =
          Math.max(Date.parse(now()), Date.parse(current.document.endsAt)) + 30 * 86400000;
        const managementUrl = options.getManagementUrl(
          signManagementLink(job.reservationId, current.tokenVersion, expiry, managementSecret),
        );
        const url = new URL(managementUrl);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid management URL");
        const r = job.document;
        const subject = `Reservation ${job.kind === "booked" ? r.status : job.kind}`;
        let email: ReservationEmail = {
          id: job.id,
          kind: job.kind,
          to: r.customer.email,
          locale: r.locale,
          reservation: r,
          managementUrl,
          subject,
          text: `${r.serviceName}\n${r.resourceName}\n${r.mode === "stay" ? "Arrival: " : ""}${new Intl.DateTimeFormat(r.locale, { dateStyle: "full", timeStyle: "short", timeZone: r.timeZone }).format(new Date(r.startsAt))} (${r.timeZone})${r.mode === "stay" ? `\nDeparture: ${new Intl.DateTimeFormat(r.locale, { dateStyle: "full", timeStyle: "short", timeZone: r.timeZone }).format(new Date(r.endsAt))} (${r.timeZone})\nNights: ${r.nights}` : ""}\nStatus: ${r.status}\nManage your reservation: ${managementUrl}`,
        };
        if (options.formatEmail) email = { ...email, ...(await options.formatEmail(email)) };
        else
          email = {
            ...email,
            ...(await renderEmail({
              brand: { name: r.serviceName },
              locale: r.locale,
              preview: subject,
              heading: subject,
              greeting: `Hello ${r.customer.name},`,
              paragraphs: [r.resourceName],
              details: [
                {
                  label: r.mode === "stay" ? "Arrival" : "When",
                  value: new Intl.DateTimeFormat(r.locale, {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: r.timeZone,
                  }).format(new Date(r.startsAt)),
                },
                {
                  label: r.mode === "stay" ? "Departure" : "Until",
                  value: new Intl.DateTimeFormat(r.locale, {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: r.timeZone,
                  }).format(new Date(r.endsAt)),
                },
                { label: "Time zone", value: r.timeZone },
                ...(r.mode === "stay" ? [{ label: "Nights", value: String(r.nights) }] : []),
                { label: "Status", value: r.status },
              ],
              action: { label: "Manage your reservation", url: managementUrl },
            })),
          };
        await options.sendEmail(email);
        await db
          .update(notifications)
          .set({ sentAt: new Date(now()), leaseId: null, leaseUntil: null, error: null })
          .where(and(eq(notifications.id, job.id), eq(notifications.leaseId, leaseId)));
        sent++;
      } catch {
        const delay = Math.min(1440, 2 ** Math.min(job.attempts, 11));
        await db
          .update(notifications)
          .set({
            error: "DELIVERY_FAILED",
            nextAttempt: new Date(Date.parse(now()) + delay * 60000),
            leaseId: null,
            leaseUntil: null,
          })
          .where(and(eq(notifications.id, job.id), eq(notifications.leaseId, leaseId)));
        failed++;
      }
    }
    return { sent, failed };
  }

  return { publicClient, managementClient, adminClient, deliverNotifications };
}
