import assert from "node:assert/strict";

import "../drive-storage/register.mjs";
import "../register-mailing.mjs";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { initializeStorage } from "../persistence/migrations.mjs";

const { createReservationsService, deriveManagementSecret } =
  await import("../../registry/components/plugins/reservations/server/index.ts");
const { reservationPolicyDefaults } =
  await import("../../registry/components/plugins/reservations/model.ts");
const { signManagementLink } =
  await import("../../registry/components/plugins/reservations/server/links.ts");
const pool = postgres(
  "postgres://reservations_test:local_reservations_test_only@127.0.0.1:55451/reservations_test",
  { max: 8, prepare: false },
);
const queries = [];
const db = drizzle({ client: pool, logger: { logQuery: (query) => queries.push(query) } });
const secret = deriveManagementSecret("reservations-integration-only-secret");
const rejected = (promise, code) => assert.rejects(promise, (e) => e.code === code);

await test("PostgreSQL booking integrity, authorization, private links and durable notifications", async (t) => {
  t.after(() => pool.end());
  await pool.unsafe(
    "DROP TABLE IF EXISTS reservations_notification,reservations_booking,reservations_resource,reservations_service,reservations_settings CASCADE",
  );
  await initializeStorage(pool, ["reservations"]);
  let clock = new Date("2026-09-27T06:00:00Z");
  let clockReads = 0;
  let mailFails = false;
  let staffAuthorized = true;
  const emails = [];
  const service = createReservationsService({
    mode: "appointment",
    db,
    managementSecret: secret,
    now: () => {
      clockReads++;
      return clock;
    },
    authorize: async (actor, action) =>
      actor === "admin" || (actor === "staff" && staffAuthorized && action !== "settings"),
    getManagementUrl: (token) => `https://example.test/reservations/manage#${token}`,
    sendEmail: async (email) => {
      if (mailFails) throw new Error("private provider error");
      emails.push(email);
    },
  });
  const wrongMode = createReservationsService({
    mode: "stay",
    db,
    managementSecret: secret,
    authorize: async () => true,
    getManagementUrl: () => "https://example.test/manage",
    sendEmail: async () => {},
  });
  assert.equal((await wrongMode.publicClient.catalog()).mode, "stay");
  assert.equal((await service.publicClient.catalog()).mode, "appointment");
  const admin = service.adminClient("admin");
  await rejected(service.adminClient("guest").configuration(), "FORBIDDEN");
  await rejected(
    service
      .adminClient("staff")
      .saveSettings({ version: 0, timeZone: "UTC", publicBookingEnabled: true }),
    "FORBIDDEN",
  );
  await admin.saveSettings({ version: 0, timeZone: "Europe/Zurich", publicBookingEnabled: true });
  // Simulate a pre-mode settings document; upgrading source must not reinterpret it.
  await pool.unsafe("UPDATE reservations_settings SET document = document - 'mode'");
  assert.equal((await admin.configuration()).mode, "appointment");
  await rejected(wrongMode.publicClient.catalog(), "MODE_MISMATCH");
  const resource = await admin.saveResource({
    id: crypto.randomUUID(),
    version: 0,
    name: "Alex",
    active: true,
    archived: false,
    weeklyHours: { 1: [{ start: "09:00", end: "17:00" }] },
    exceptions: {},
  });
  const item = await admin.saveService({
    ...reservationPolicyDefaults,
    id: crypto.randomUUID(),
    version: 0,
    name: "Appointment",
    description: "",
    durationMinutes: 45,
    bufferAfterMinutes: 15,
    approval: "manual",
    active: true,
    archived: false,
    resourceIds: [resource.id],
  });
  const input = {
    requestId: crypto.randomUUID(),
    serviceId: item.id,
    resourceId: resource.id,
    startsAt: "2026-09-28T07:00:00.000Z",
    customer: { name: "Customer", email: "guest@example.test", phone: "" },
    locale: "en",
  };
  const results = await Promise.allSettled([
    service.publicClient.book(input),
    service.publicClient.book({ ...input, requestId: crypto.randomUUID() }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected")[0].reason.code, "CONFLICT");
  const first = results.find((r) => r.status === "fulfilled").value;
  await t.test(
    "month batching shares reads and time, preserving daily results and permissions",
    async () => {
      const query = { serviceId: item.id, resourceId: resource.id, month: "2026-09-01" };
      queries.length = 0;
      clockReads = 0;
      const month = await service.publicClient.monthAvailability(query);
      assert.equal(clockReads, 1);
      assert.equal(queries.length, 5);
      for (const table of [
        "reservations_service",
        "reservations_resource",
        "reservations_booking",
      ]) {
        assert.equal(queries.filter((sql) => sql.includes(`from "${table}"`)).length, 1);
      }
      assert.equal(Object.keys(month).length, 42);
      for (const [date, available] of Object.entries(month)) {
        assert.equal(
          available,
          (await service.publicClient.availability({ ...query, date })).length > 0,
        );
      }
      for (const invalid of [
        null,
        { ...query, month: "2026-09-02" },
        { ...query, serviceId: "invalid" },
      ]) {
        queries.length = 0;
        await rejected(service.publicClient.monthAvailability(invalid), "INVALID");
        assert.equal(queries.length, 0);
      }
      queries.length = 0;
      await rejected(service.adminClient("guest").monthAvailability(query), "FORBIDDEN");
      assert.equal(queries.length, 0);
      const settings = (await admin.configuration()).settings;
      const closed = await admin.saveSettings({ ...settings, publicBookingEnabled: false });
      assert.ok(
        Object.values(
          await service.publicClient.monthAvailability({ ...query, staff: true }),
        ).every((value) => value === false),
      );
      assert.equal(
        (await service.adminClient("staff").monthAvailability(query))["2026-09-28"],
        true,
      );
      await admin.saveSettings({ ...closed, publicBookingEnabled: true });
    },
  );
  const concurrentInput = {
    ...input,
    requestId: crypto.randomUUID(),
    startsAt: "2026-09-28T08:00:00.000Z",
  };
  const duplicates = await Promise.all([
    service.publicClient.book(concurrentInput),
    service.publicClient.book(concurrentInput),
  ]);
  assert.equal(duplicates[0].id, duplicates[1].id);
  await rejected(
    service.publicClient.book({ ...concurrentInput, startsAt: "2026-09-28T09:00:00.000Z" }),
    "CONFLICT",
  );
  await rejected(admin.setStatus(first.id, 0, "confirmed"), "CONFLICT");
  const confirmed = await admin.setStatus(first.id, first.version, "confirmed");
  await admin.saveService({
    ...item,
    durationMinutes: 15,
    approval: "automatic",
    cancellationMinutes: 0,
  });
  const privateToken = signManagementLink(first.id, 1, Date.parse("2027-01-01T00:00:00Z"), secret);
  const guest = service.managementClient(privateToken);
  await rejected(
    guest.reschedule({ version: confirmed.version, startsAt: concurrentInput.startsAt }),
    "CONFLICT",
  );
  assert.equal((await guest.get()).reservation.startsAt, first.startsAt);
  const moved = await guest.reschedule({
    version: confirmed.version,
    startsAt: "2026-09-28T09:00:00.000Z",
  });
  assert.equal(moved.status, "pending");
  assert.equal(moved.policy.durationMinutes, 45);
  assert.ok(
    (await service.publicClient.availability({ serviceId: item.id, date: "2026-09-28" })).some(
      (s) => s.startsAt === first.startsAt,
    ),
  );
  await rejected(admin.saveResource({ ...resource, exceptions: { "2026-09-28": [] } }), "CONFLICT");
  const revisedResource = await admin.saveResource({ ...resource, weeklyHours: {} });
  const range = { from: "2026-09-28T00:00:00Z", to: "2026-09-29T00:00:00Z" };
  assert.ok((await admin.list(range)).every((r) => r.outsideHours));
  await admin.saveResource({ ...revisedResource, weeklyHours: resource.weeklyHours });
  clock = new Date(moved.cancellationDeadline);
  await rejected(guest.cancel(moved.version), "CUTOFF");
  await rejected(
    guest.reschedule({ version: moved.version, startsAt: "2026-09-28T10:00:00Z" }),
    "CUTOFF",
  );
  const cancelled = await admin.setStatus(moved.id, moved.version, "cancelled");
  assert.equal(cancelled.status, "cancelled");
  await rejected(service.managementClient(privateToken + "x").get(), "INVALID_LINK");
  await rejected(
    service.managementClient(signManagementLink(first.id, 1, clock.getTime(), secret)).get(),
    "INVALID_LINK",
  );
  await admin.revokeLink(first.id, cancelled.version);
  await rejected(guest.get(), "INVALID_LINK");
  mailFails = true;
  const failed = await service.deliverNotifications();
  assert.equal(failed.failed, 2);
  assert.ok((await admin.list(range)).every((r) => r.emailFailed));
  await admin.retryEmail(first.id);
  await admin.retryEmail(duplicates[0].id);
  mailFails = false;
  const sent = await Promise.all([service.deliverNotifications(), service.deliverNotifications()]);
  assert.ok(sent.reduce((sum, r) => sum + r.sent, 0) >= 6);
  assert.equal(emails.length, new Set(emails.map((e) => e.id)).size);
  for (const email of emails) {
    assert.match(email.html, /<!DOCTYPE html/i);
    assert.ok(email.html.includes(email.managementUrl));
    assert.ok(email.text.includes(email.managementUrl));
  }
  assert.ok((await admin.list(range)).every((r) => !r.emailFailed));
  const newToken = new URL(
    emails.findLast((e) => e.reservation.id === first.id).managementUrl,
  ).hash.slice(1);
  assert.equal((await service.managementClient(newToken).get()).reservation.status, "cancelled");
  const customEmails = [];
  const customOptions = {
    mode: "appointment",
    db,
    managementSecret: secret,
    now: () => clock,
    authorize: async () => true,
    getManagementUrl: () => "https://example.test/calendar",
    sendEmail: async (email) => {
      customEmails.push(email);
    },
  };
  const textOnly = createReservationsService({
    ...customOptions,
    formatEmail: () => ({ subject: "Host subject", text: "Host text" }),
  });
  const current = (await admin.list(range)).find((item) => item.id === first.id);
  const updatedLink = await admin.revokeLink(first.id, current.version);
  await textOnly.deliverNotifications();
  assert.equal(customEmails.at(-1).subject, "Host subject");
  assert.equal(customEmails.at(-1).text, "Host text");
  assert.equal(customEmails.at(-1).html, undefined);
  let formatFails = true;
  const formattedIds = [];
  const customHtml = createReservationsService({
    ...customOptions,
    formatEmail: async (email) => {
      formattedIds.push(email.id);
      if (formatFails) throw new Error("render failed");
      return { subject: "Host subject", text: "Host text", html: "<p>Host text</p>" };
    },
  });
  await admin.revokeLink(first.id, updatedLink.version);
  const previousCount = customEmails.length;
  assert.equal((await customHtml.deliverNotifications()).failed, 1);
  assert.equal(customEmails.length, previousCount);
  await admin.retryEmail(first.id);
  formatFails = false;
  assert.equal((await customHtml.deliverNotifications()).sent, 1);
  assert.deepEqual(formattedIds, [customEmails.at(-1).id, customEmails.at(-1).id]);
  assert.equal(customEmails.at(-1).html, "<p>Host text</p>");
  const publicJson = JSON.stringify(await service.publicClient.catalog());
  assert.ok(!publicJson.includes("guest@example.test"));
  assert.ok(!publicJson.includes("weeklyHours"));
  const resources = (await admin.configuration()).resources;
  await admin.saveResource({ ...resources[0], archived: true });
  assert.equal((await service.publicClient.catalog()).resources.length, 0);
  assert.equal((await admin.list(range)).length, 2);
  await rejected(
    service.publicClient.book({
      ...input,
      requestId: crypto.randomUUID(),
      customer: { ...input.customer, email: "bad" },
    }),
    "INVALID",
  );
  await rejected(
    admin.list({ from: "2020-01-01T00:00:00Z", to: "2027-01-01T00:00:00Z" }),
    "INVALID",
  );

  const staff = service.adminClient("staff");
  await staff.configuration();
  staffAuthorized = false;
  await rejected(staff.configuration(), "FORBIDDEN");
  await rejected(staff.book({ ...input, requestId: crypto.randomUUID() }), "FORBIDDEN");

  const extra = await Promise.all(
    ["Jordan", "Taylor"].map((name) =>
      admin.saveResource({ ...resource, id: crypto.randomUUID(), version: 0, name }),
    ),
  );
  const automatic = await admin.saveService({
    ...item,
    id: crypto.randomUUID(),
    version: 0,
    approval: "automatic",
    bufferBeforeMinutes: 30,
    bufferAfterMinutes: 0,
    noticeMinutes: 0,
    resourceIds: extra.map((r) => r.id),
  });
  const anyResource = {
    ...input,
    serviceId: automatic.id,
    resourceId: undefined,
    startsAt: "2026-09-28T08:00:00.000Z",
  };
  const assigned = await Promise.all(
    [0, 1].map(() => service.publicClient.book({ ...anyResource, requestId: crypto.randomUUID() })),
  );
  assert.equal(new Set(assigned.map((r) => r.resourceId)).size, 2);
  assert.ok(assigned.every((r) => r.status === "confirmed"));
  await rejected(
    service.publicClient.book({ ...anyResource, requestId: crypto.randomUUID() }),
    "CONFLICT",
  );
  clock = new Date("2026-09-28T08:50:00.000Z");
  // Both previous appointments ended at 08:45, but new preparation begins at 08:30.
  const overlap = { ...anyResource, startsAt: "2026-09-28T09:00:00.000Z" };
  await rejected(admin.book({ ...overlap, requestId: crypto.randomUUID() }), "CONFLICT");
  const availability = await admin.availability({ serviceId: automatic.id, date: "2026-09-28" });
  assert.equal(availability[0].startsAt, "2026-09-28T09:15:00.000Z");
  await admin.saveService({ ...automatic, archived: true });
  assert.equal((await admin.list(range)).length, 4);
  assert.ok(!(await service.publicClient.catalog()).services.some((s) => s.id === automatic.id));
  await t.test(
    "all-date pages filter in SQL, stay bounded and enforce fresh authority",
    async () => {
      const { reservations: table } =
        await import("../../registry/components/plugins/reservations/server/schema.ts");
      const inserted = Array.from({ length: 25 }, (_, index) => {
        const startsAt = new Date(Date.UTC(2020 + index, 0, 1, 10)).toISOString();
        const endsAt = new Date(Date.parse(startsAt) + 3600000).toISOString();
        const id = crypto.randomUUID();
        const document = {
          ...first,
          id,
          startsAt,
          endsAt,
          occupiedStart: startsAt,
          occupiedEnd: endsAt,
          status: index % 2 ? "pending" : "rejected",
        };
        return {
          id,
          document,
          requestId: crypto.randomUUID(),
          requestHash: "list-fixture",
          resourceId: first.resourceId,
          serviceId: first.serviceId,
          startsAt: new Date(startsAt),
          occupiedEnd: new Date(endsAt),
        };
      });
      await db.insert(table).values(inserted);
      const a = await admin.listPage({ page: 1 });
      const b = await admin.listPage({ page: 2 });
      assert.equal(a.items.length, 20);
      assert.equal(a.hasMore, true);
      assert.equal(b.items.length, 9);
      assert.equal(b.hasMore, false);
      assert.equal(new Set([...a.items, ...b.items].map((r) => r.id)).size, 29);
      assert.ok(a.items.some((r) => r.startsAt.startsWith("2020")));
      assert.ok(b.items.some((r) => r.startsAt.startsWith("2044")));
      const filtered = await admin.listPage({
        page: 1,
        status: "rejected",
        resourceId: first.resourceId,
        serviceId: first.serviceId,
      });
      assert.ok(filtered.items.length >= 13);
      assert.ok(
        filtered.items.every(
          (r) =>
            r.status === "rejected" &&
            r.resourceId === first.resourceId &&
            r.serviceId === first.serviceId,
        ),
      );
      assert.deepEqual(await admin.listPage({ page: 1, resourceId: crypto.randomUUID() }), {
        items: [],
        hasMore: false,
      });
      await rejected(admin.listPage({ page: 0 }), "INVALID");
      await rejected(admin.listPage({ page: 1, status: "invalid" }), "INVALID");
      await rejected(service.adminClient("guest").listPage({ page: 1 }), "FORBIDDEN");
      await rejected(staff.listPage({ page: 1 }), "FORBIDDEN");
    },
  );
  await t.test(
    "stay transactions, policy snapshots, closures, private moves and delivery retries",
    async () => {
      await pool.unsafe(
        "TRUNCATE reservations_notification,reservations_booking,reservations_resource,reservations_service,reservations_settings CASCADE",
      );
      clock = new Date("2026-09-27T06:00:00Z");
      const sent = [];
      let failing = true;
      const stays = createReservationsService({
        mode: "stay",
        db,
        managementSecret: secret,
        now: () => clock,
        authorize: async (actor) => actor === "admin",
        getManagementUrl: (token) => `https://example.test/manage#${token}`,
        sendEmail: async (email) => {
          if (failing) throw new Error("mail offline");
          sent.push(email);
        },
      });
      const staff = stays.adminClient("admin");
      await staff.saveSettings({
        version: 0,
        timeZone: "Europe/Zurich",
        publicBookingEnabled: true,
      });
      assert.equal((await stays.publicClient.catalog()).mode, "stay");
      await rejected(service.publicClient.catalog(), "MODE_MISMATCH");
      await rejected(stays.adminClient("guest").configuration(), "FORBIDDEN");
      const rooms = await Promise.all(
        [1, 2].map((i) =>
          staff.saveResource({
            id: crypto.randomUUID(),
            version: 0,
            name: `Apartment ${i}`,
            active: true,
            archived: false,
            weeklyHours: {},
            exceptions: {},
            blockedDates: [],
          }),
        ),
      );
      const stayService = await staff.saveService({
        ...reservationPolicyDefaults,
        mode: "stay",
        arrivalStart: "13:00",
        arrivalEnd: "20:00",
        checkoutTime: "11:00",
        minNights: 1,
        maxNights: 30,
        id: crypto.randomUUID(),
        version: 0,
        name: "Apartment stay",
        description: "",
        active: true,
        archived: false,
        approval: "manual",
        bufferAfterMinutes: 120,
        resourceIds: rooms.map((r) => r.id),
      });
      const stayInput = {
        ...input,
        requestId: crypto.randomUUID(),
        serviceId: stayService.id,
        resourceId: rooms[0].id,
        startsAt: "2026-09-28T13:00:00.000Z",
        departureDate: "2026-10-01",
      };
      const competing = { ...stayInput, requestId: crypto.randomUUID() };
      const attempts = await Promise.allSettled([
        stays.publicClient.book(stayInput),
        stays.publicClient.book(competing),
      ]);
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      const firstStay = attempts.find((r) => r.status === "fulfilled").value;
      const winning = attempts[0].status === "fulfilled" ? stayInput : competing;
      const replay = await stays.publicClient.book(winning);
      assert.equal(replay.id, firstStay.id);
      assert.equal(firstStay.nights, 3);
      assert.equal(firstStay.endsAt, "2026-10-01T09:00:00.000Z");
      assert.equal(firstStay.status, "pending");
      await rejected(
        stays.publicClient.book({ ...winning, departureDate: "2026-10-02" }),
        "CONFLICT",
      );
      const assigned = await stays.publicClient.book({
        ...stayInput,
        requestId: crypto.randomUUID(),
        resourceId: undefined,
      });
      assert.equal(assigned.resourceId, rooms[1].id);
      await rejected(
        stays.publicClient.book({
          ...stayInput,
          requestId: crypto.randomUUID(),
          resourceId: undefined,
        }),
        "CONFLICT",
      );
      await rejected(
        staff.saveResource({
          ...rooms[0],
          blockedDates: [{ from: "2026-09-29", through: "2026-09-29" }],
        }),
        "CONFLICT",
      );
      const blocked = await staff.saveResource({
        ...rooms[0],
        blockedDates: [{ from: "2026-10-10", through: "2026-10-12" }],
      });
      assert.deepEqual(
        await stays.publicClient.availability({
          serviceId: stayService.id,
          resourceId: rooms[0].id,
          date: "2026-10-09",
          departureDate: "2026-10-13",
        }),
        [],
      );
      const changedPolicy = await staff.saveService({
        ...stayService,
        checkoutTime: "09:00",
        approval: "automatic",
      });
      const token = signManagementLink(firstStay.id, 1, Date.parse("2027-01-01T00:00:00Z"), secret);
      const guest = stays.managementClient(token);
      await rejected(
        guest.reschedule({
          version: firstStay.version,
          startsAt: firstStay.startsAt,
          departureDate: "2026-10-01",
          resourceId: rooms[1].id,
        }),
        "CONFLICT",
      );
      assert.equal((await guest.get()).reservation.endsAt, firstStay.endsAt);
      const movedStay = await guest.reschedule({
        version: firstStay.version,
        startsAt: "2026-10-02T13:00:00.000Z",
        departureDate: "2026-10-05",
        resourceId: rooms[0].id,
      });
      assert.equal(movedStay.status, "pending");
      assert.equal(movedStay.endsAt, "2026-10-05T09:00:00.000Z");
      await rejected(guest.cancel(firstStay.version), "CONFLICT");
      assert.ok(
        (
          await stays.publicClient.availability({
            serviceId: stayService.id,
            resourceId: rooms[0].id,
            date: "2026-09-28",
            departureDate: "2026-10-01",
          })
        ).length,
      );
      assert.equal(
        (await staff.list({ from: "2026-09-29T00:00:00Z", to: "2026-09-30T00:00:00Z" })).length,
        1,
      );
      assert.equal(
        (await staff.list({ from: "2026-10-03T00:00:00Z", to: "2026-10-04T00:00:00Z" }))[0]
          .outsideHours,
        false,
      );
      await stays.deliverNotifications();
      assert.ok(
        (await staff.list({ from: "2026-10-02T00:00:00Z", to: "2026-10-06T00:00:00Z" }))[0]
          .emailFailed,
      );
      failing = false;
      await staff.retryEmail(firstStay.id);
      await staff.retryEmail(assigned.id);
      await stays.deliverNotifications();
      assert.equal(new Set(sent.map((e) => e.id)).size, sent.length);
      assert.match(sent[0].text, /Arrival:.*\nDeparture:/s);
      assert.match(sent[0].text, /Nights: 3/);
      const approved = await staff.setStatus(movedStay.id, movedStay.version, "confirmed");
      clock = new Date(approved.cancellationDeadline);
      await rejected(guest.cancel(approved.version), "CUTOFF");
      await staff.setStatus(approved.id, approved.version, "cancelled");
      await staff.setStatus(assigned.id, assigned.version, "rejected");
      await staff.saveResource({ ...blocked, archived: true });
      await staff.saveService({ ...changedPolicy, archived: true });
      assert.equal(
        (await staff.list({ from: "2026-09-28T00:00:00Z", to: "2026-10-06T00:00:00Z" })).length,
        2,
      );
    },
  );
});
