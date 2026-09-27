import { createHash, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
  ReservationError,
  type Reservation,
  type ReservationBookingInput,
  type ReservationConfiguration,
  type ReservationManagementClient,
  type ReservationResource,
  type ReservationService,
  type ReservationSettings,
  type ReservationMode,
  type ReservationsAdminClient,
  type ReservationsPublicClient,
} from "@/components/plugins/reservations/types";

export type ReservationsTransaction = Pick<PostgresJsDatabase, "execute">;
export interface ReservationsDatabase extends ReservationsTransaction {
  transaction<T>(action: (tx: ReservationsTransaction) => Promise<T>): Promise<T>;
}
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
  formatEmail?: (email: ReservationEmail) => Pick<ReservationEmail, "subject" | "text">;
  now?: () => Date;
}

type BookingRow = { document: Reservation; token_version: number };
type Job = {
  id: string;
  reservation_id: string;
  version: number;
  kind: ReservationEmailKind;
  document: Reservation;
  attempts: number;
};

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
        // ponytail: one scheduling writer per business/database; switch to ordered resource
        // locks when measured write throughput warrants the additional locking protocol.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('forge-reservations'))`);
        await installationMode(tx, true);
        return action(tx);
      }),
    );
  }
  async function installationMode(tx: ReservationsTransaction, initialize = false) {
    const [row] = await tx.execute<{ document: ReservationSettings & { mode?: ReservationMode } }>(
      sql`select document from reservations_settings where id='business'`,
    );
    const [legacy] = row
      ? []
      : await tx.execute<{ exists: boolean }>(
          sql`select exists(select 1 from reservations_resource union all select 1 from reservations_service union all select 1 from reservations_booking)`,
        );
    const saved = row
      ? (row.document.mode ?? "appointment")
      : legacy?.exists
        ? "appointment"
        : undefined;
    if (saved && saved !== mode) throw new ReservationError("MODE_MISMATCH");
    if (initialize && !row?.document.mode) {
      const document = {
        ...(row?.document ?? { version: 0, timeZone: "UTC", publicBookingEnabled: false }),
        mode,
      };
      await tx.execute(
        sql`insert into reservations_settings (id,document) values ('business',${JSON.stringify(document)}::jsonb) on conflict (id) do update set document=excluded.document`,
      );
    }
  }
  async function configuration(tx: ReservationsTransaction): Promise<ReservationConfiguration> {
    await installationMode(tx);
    const [settings] = await tx.execute<{ document: ReservationSettings }>(
      sql`select document from reservations_settings where id='business'`,
    );
    const services = await tx.execute<{ document: ReservationService }>(
      sql`select document from reservations_service order by id`,
    );
    const resources = await tx.execute<{ document: ReservationResource }>(
      sql`select document from reservations_resource order by id`,
    );
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
      await tx.execute<{ document: Reservation }>(
        sql`select document from reservations_booking where occupied_end > ${at}::timestamptz - interval '1 day' and document->>'status' in ('pending','confirmed')`,
      )
    ).map((r) => r.document);
  }
  async function booking(tx: ReservationsTransaction, id: string): Promise<BookingRow> {
    parseReservationId(id);
    const [row] = await tx.execute<BookingRow>(
      sql`select document,token_version from reservations_booking where id=${id}`,
    );
    if (!row) throw new ReservationError("NOT_FOUND");
    return { ...row, document: { ...row.document, mode: row.document.mode ?? "appointment" } };
  }
  async function linked(tx: ReservationsTransaction, token: string): Promise<BookingRow> {
    const claim = verifyManagementLink(token, managementSecret, Date.parse(now()));
    const rows = await tx.execute<BookingRow>(
      sql`select document,token_version from reservations_booking where id=${claim.id}`,
    );
    if (!rows[0] || rows[0].token_version !== claim.version)
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
    await tx.execute(
      sql`insert into reservations_notification (id,reservation_id,version,kind,document,next_attempt) values (${randomUUID()},${reservation.id},${reservation.version},${kind},${JSON.stringify(reservation)}::jsonb,${now()}::timestamptz)`,
    );
  }
  async function update(
    tx: ReservationsTransaction,
    reservation: Reservation,
    kind: ReservationEmailKind,
  ) {
    await tx.execute(
      sql`update reservations_booking set document=${JSON.stringify(reservation)}::jsonb,resource_id=${reservation.resourceId},starts_at=${reservation.startsAt}::timestamptz,occupied_end=${reservation.occupiedEnd}::timestamptz where id=${reservation.id}`,
    );
    await enqueue(tx, reservation, kind);
    return reservation;
  }
  async function create(input: ReservationBookingInput, staff: boolean): Promise<Reservation> {
    const value = parseReservationInput(bookingSchema, input);
    const requestId = `${staff ? "staff" : "public"}:${value.requestId}`;
    const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    return mutate(async (tx) => {
      const [existing] = await tx.execute<{ document: Reservation; request_hash: string }>(
        sql`select document,request_hash from reservations_booking where request_id=${requestId}`,
      );
      if (existing) {
        if (existing.request_hash !== hash) throw new ReservationError("CONFLICT");
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
      await tx.execute(
        sql`insert into reservations_booking (id,document,request_id,request_hash,resource_id,service_id,starts_at,occupied_end) values (${reservation.id},${JSON.stringify(reservation)}::jsonb,${requestId},${hash},${reservation.resourceId},${reservation.serviceId},${reservation.startsAt}::timestamptz,${reservation.occupiedEnd}::timestamptz)`,
      );
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
          const rows = await db.execute<{ document: Reservation; email_failed: boolean }>(
            sql`select b.document,exists(select 1 from reservations_notification n where n.reservation_id=b.id and n.sent_at is null and n.error is not null) as email_failed from reservations_booking b where b.starts_at < ${range.to}::timestamptz and b.occupied_end > ${range.from}::timestamptz order by b.starts_at,b.id`,
          );
          return rows
            .filter(
              ({ document: r }) =>
                (!range.resourceId || r.resourceId === range.resourceId) &&
                (!range.serviceId || r.serviceId === range.serviceId) &&
                (!range.status || r.status === range.status),
            )
            .map(({ document: r, email_failed }) => {
              const resource = config.resources.find((value) => value.id === r.resourceId);
              return {
                ...r,
                mode: r.mode ?? "appointment",
                emailFailed: email_failed,
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
          await tx.execute(
            sql`insert into reservations_settings (id,document) values ('business',${JSON.stringify(next)}::jsonb) on conflict (id) do update set document=excluded.document`,
          );
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
          await tx.execute(
            sql`insert into reservations_service (id,document) values (${next.id},${JSON.stringify(next)}::jsonb) on conflict (id) do update set document=excluded.document`,
          );
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
          await tx.execute(
            sql`insert into reservations_resource (id,document) values (${next.id},${JSON.stringify(next)}::jsonb) on conflict (id) do update set document=excluded.document`,
          );
          return next;
        }),
      retryEmail: (id) =>
        write("manage", async (tx) => {
          await booking(tx, id);
          await tx.execute(
            sql`update reservations_notification set next_attempt=${now()}::timestamptz where reservation_id=${id} and sent_at is null`,
          );
        }),
      revokeLink: (id, version) =>
        write("manage", async (tx) => {
          const { document: current } = await booking(tx, id);
          assertVersion(current.version, version);
          await tx.execute(
            sql`update reservations_booking set token_version=token_version+1 where id=${id}`,
          );
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
        const [next] = await tx.execute<Job>(
          sql`select n.id,n.reservation_id,n.version,n.kind,n.document,n.attempts from reservations_notification n where n.sent_at is null and n.next_attempt <= ${now()}::timestamptz and (n.lease_until is null or n.lease_until <= ${now()}::timestamptz) and not exists (select 1 from reservations_notification older where older.reservation_id=n.reservation_id and older.version<n.version and older.sent_at is null) order by n.next_attempt,n.id limit 1`,
        );
        if (!next) return undefined;
        await tx.execute(
          sql`update reservations_notification set lease_id=${leaseId},lease_until=${now()}::timestamptz+interval '5 minutes',attempts=attempts+1 where id=${next.id}`,
        );
        return next;
      });
      if (!job) break;
      try {
        const current = await booking(db, job.reservation_id);
        const expiry =
          Math.max(Date.parse(now()), Date.parse(current.document.endsAt)) + 30 * 86400000;
        const managementUrl = options.getManagementUrl(
          signManagementLink(job.reservation_id, current.token_version, expiry, managementSecret),
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
        if (options.formatEmail) email = { ...email, ...options.formatEmail(email) };
        await options.sendEmail(email);
        await db.execute(
          sql`update reservations_notification set sent_at=${now()}::timestamptz,lease_id=null,lease_until=null,error=null where id=${job.id} and lease_id=${leaseId}`,
        );
        sent++;
      } catch {
        const delay = Math.min(1440, 2 ** Math.min(job.attempts, 11));
        await db.execute(
          sql`update reservations_notification set error='DELIVERY_FAILED',next_attempt=${now()}::timestamptz+${delay}*interval '1 minute',lease_id=null,lease_until=null where id=${job.id} and lease_id=${leaseId}`,
        );
        failed++;
      }
    }
    return { sent, failed };
  }

  return { publicClient, managementClient, adminClient, deliverNotifications };
}
