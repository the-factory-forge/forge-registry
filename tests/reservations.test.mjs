import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const {
  availableSlots,
  availableMonth,
  monthAvailabilitySchema,
  assertResourceExceptions,
  canCustomerChange,
  placeReservation,
  parseReservationInput,
  resourceSchema,
  bookingSchema,
  loadReservationCalendar,
  reservationDayCounts,
  rangeSchema,
  serviceSchema,
  reservationPolicyDefaults,
  changeStatus,
  previewReservationMove,
} = await import("../registry/components/plugins/reservations/model.ts");
const { deriveManagementSecret, signManagementLink, verifyManagementLink } =
  await import("../registry/components/plugins/reservations/server/links.ts");

export const resourceId = "10000000-0000-4000-8000-000000000001";
export const serviceId = "20000000-0000-4000-8000-000000000001";
const resource = {
  id: resourceId,
  version: 1,
  name: "Alex",
  active: true,
  archived: false,
  weeklyHours: {
    1: [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ],
  },
  exceptions: {},
};
const service = {
  ...reservationPolicyDefaults,
  id: serviceId,
  version: 1,
  name: "Haircut",
  description: "",
  active: true,
  archived: false,
  durationMinutes: 45,
  bufferAfterMinutes: 15,
  resourceIds: [resourceId],
};
const config = {
  settings: { version: 1, timeZone: "Europe/Zurich", publicBookingEnabled: true },
  services: [service],
  resources: [resource],
};
const now = "2026-09-27T06:00:00.000Z";
const input = {
  requestId: "30000000-0000-4000-8000-000000000001",
  serviceId,
  startsAt: "2026-09-28T07:00:00.000Z",
  customer: { name: "Guest", email: "guest@example.com", phone: "" },
  locale: "en",
};
const booking = () =>
  placeReservation(config, [], input, now, "40000000-0000-4000-8000-000000000001");

await test("month overview matches daily appointment rules across month and clock changes", () => {
  for (const month of ["2026-03-01", "2026-10-01", "2028-02-01"]) {
    const at = `${month}T06:00:00.000Z`;
    const c = structuredClone(config);
    c.resources[0].weeklyHours[7] = [{ start: "01:00", end: "05:00" }];
    c.resources[0].exceptions[`${month.slice(0, 7)}-09`] = [];
    c.services[0].noticeMinutes = 1440;
    c.services[0].horizonDays = 30;
    for (const staff of [false, true]) {
      for (const publicBookingEnabled of [false, true]) {
        c.settings.publicBookingEnabled = publicBookingEnabled;
        for (const selectedResource of [
          undefined,
          resourceId,
          "10000000-0000-4000-8000-000000000099",
        ]) {
          const query = { serviceId, resourceId: selectedResource, month };
          const result = availableMonth(c, [booking()], query, at, { staff });
          const dates = Object.keys(result);
          assert.equal(dates.length, 42);
          assert.equal(new Date(`${dates[0]}T12:00:00Z`).getUTCDay(), 1);
          assert.equal((Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000, 41);
          for (const date of dates) {
            assert.equal(
              result[date],
              availableSlots(
                c,
                [booking()],
                { serviceId, resourceId: selectedResource, date },
                at,
                { staff },
              ).length > 0,
            );
          }
        }
      }
    }
  }
  assert.throws(
    () => availableMonth({ ...config, mode: "stay" }, [], { serviceId, month: "2026-10-01" }, now),
    { code: "MODE_MISMATCH" },
  );
});

await test("month overview accepts one calendar month and strips caller policy overrides", () => {
  const query = { serviceId, month: "2026-10-01" };
  assert.deepEqual(
    parseReservationInput(monthAvailabilitySchema, {
      ...query,
      staff: true,
      reservationId: "other",
      dates: ["2099-01-01"],
    }),
    query,
  );
  for (const month of [
    undefined,
    null,
    10,
    "2026-10",
    "2026-10-02",
    "2026-13-01",
    "2026-10-01T00:00:00Z",
    ["2026-10-01", "2026-11-01"],
  ]) {
    assert.throws(() => parseReservationInput(monthAvailabilitySchema, { ...query, month }), {
      code: "INVALID",
    });
  }
  for (const input of [
    null,
    {},
    { ...query, serviceId: "invalid" },
    { ...query, resourceId: "invalid" },
  ]) {
    assert.throws(() => parseReservationInput(monthAvailabilitySchema, input), { code: "INVALID" });
  }
});

await test("duration, buffers, breaks, adjacency, closures and resource assignment", () => {
  const r = booking();
  assert.equal(r.endsAt, "2026-09-28T07:45:00.000Z");
  assert.equal(r.occupiedEnd, "2026-09-28T08:00:00.000Z");
  const slots = availableSlots(config, [r], { serviceId, date: "2026-09-28" }, now);
  assert.equal(slots[0].startsAt, r.occupiedEnd);
  assert.ok(!slots.some((s) => s.startsAt === "2026-09-28T09:15:00.000Z"));
  assert.ok(!slots.some((s) => s.startsAt === "2026-09-28T10:00:00.000Z"));
  const closed = structuredClone(config);
  closed.resources[0].exceptions["2026-09-28"] = [];
  assert.deepEqual(availableSlots(closed, [], { serviceId, date: "2026-09-28" }, now), []);
  assert.throws(
    () => assertResourceExceptions(resource, closed.resources[0], [r], config.settings.timeZone),
    {
      code: "CONFLICT",
    },
  );
  assert.doesNotThrow(() =>
    assertResourceExceptions(
      resource,
      { ...resource, weeklyHours: {} },
      [r],
      config.settings.timeZone,
    ),
  );
  const multi = structuredClone(config);
  const id = "10000000-0000-4000-8000-000000000002";
  multi.resources.push({ ...resource, id });
  multi.services[0].resourceIds.push(id);
  assert.equal(placeReservation(multi, [r], input, now, "b").resourceId, id);
});

await test("preparation and cleanup are additive and must fit inside working hours", () => {
  const c = structuredClone(config);
  c.services[0].bufferBeforeMinutes = 15;
  const slots = availableSlots(c, [booking()], { serviceId, date: "2026-09-28" }, now);
  assert.equal(slots[0].startsAt, "2026-09-28T08:15:00.000Z");
  assert.equal(
    availableSlots(c, [], { serviceId, date: "2026-09-28" }, now)[0].startsAt,
    "2026-09-28T07:15:00.000Z",
  );
});

await test("notice, horizon, disabled public booking and inactive services/resources", () => {
  const query = { serviceId, date: "2026-09-28" };
  assert.equal(
    availableSlots(config, [], query, "2026-09-28T07:00:00.000Z")[0].startsAt,
    "2026-09-28T08:00:00.000Z",
  );
  assert.deepEqual(availableSlots(config, [], { serviceId, date: "2027-09-27" }, now), []);
  const c = structuredClone(config);
  c.settings.publicBookingEnabled = false;
  assert.deepEqual(availableSlots(c, [], query, now), []);
  assert.ok(availableSlots(c, [], query, now, { staff: true }).length);
  c.settings.publicBookingEnabled = true;
  c.resources[0].archived = true;
  assert.deepEqual(availableSlots(c, [], query, now), []);
});

await test("manual requests occupy time; cancellation cutoff and policy snapshots survive changes", () => {
  const c = structuredClone(config);
  c.services[0].approval = "manual";
  const pending = placeReservation(c, [], input, now, "a");
  assert.equal(pending.status, "pending");
  assert.throws(() => placeReservation(c, [pending], input, now, "b"), { code: "CONFLICT" });
  assert.equal(canCustomerChange(pending, pending.cancellationDeadline), false);
  assert.equal(canCustomerChange(pending, "2026-09-27T06:59:59.000Z"), true);
  c.services[0].durationMinutes = 15;
  c.services[0].approval = "automatic";
  const moved = placeReservation(
    c,
    [pending],
    { ...input, startsAt: "2026-09-28T08:00:00.000Z" },
    now,
    pending.id,
    { reservation: pending },
  );
  assert.equal(moved.policy.durationMinutes, 45);
  assert.equal(moved.status, "pending");
  assert.equal(changeStatus(pending, "confirmed", now).status, "confirmed");
  assert.throws(() => changeStatus(pending, "confirmed", pending.startsAt), { code: "CONFLICT" });
  assert.ok(
    availableSlots(
      c,
      [changeStatus(pending, "rejected", now)],
      { serviceId, date: "2026-09-28" },
      now,
    ).some((s) => s.startsAt === input.startsAt),
  );
});

await test("DST skips nonexistent starts and identifies both repeated clock times", () => {
  const c = structuredClone(config);
  c.resources[0].weeklyHours = { 7: [{ start: "01:00", end: "05:00" }] };
  Object.assign(c.services[0], {
    durationMinutes: 30,
    intervalMinutes: 30,
    bufferAfterMinutes: 0,
    noticeMinutes: 0,
    horizonDays: 365,
  });
  const spring = availableSlots(
    c,
    [],
    { serviceId, date: "2026-03-29" },
    "2026-03-01T00:00:00.000Z",
  );
  assert.equal(spring.length, 6);
  const autumn = availableSlots(c, [], { serviceId, date: "2026-10-25" }, now);
  assert.equal(autumn.length, 10);
  assert.ok(autumn.some((s) => s.startsAt === "2026-10-25T00:00:00.000Z"));
  assert.ok(autumn.some((s) => s.startsAt === "2026-10-25T01:00:00.000Z"));
});

await test("business zone changes preserve bookings and apply current schedules to rescheduling", () => {
  const original = booking();
  const changed = structuredClone(config);
  changed.settings.timeZone = "America/New_York";
  const slots = availableSlots(changed, [original], { serviceId, date: "2026-09-28" }, now, {
    reservation: original,
  });
  assert.equal(slots[0].startsAt, "2026-09-28T13:00:00.000Z");
  const moved = placeReservation(
    changed,
    [original],
    { ...input, startsAt: slots[0].startsAt },
    now,
    original.id,
    { reservation: original },
  );
  assert.equal(moved.timeZone, "America/New_York");
  assert.equal(original.startsAt, input.startsAt);
  assert.deepEqual(moved.policy, original.policy);
});

await test("boundary validation rejects malformed dates, overlapping schedules and invalid policies", () => {
  assert.throws(() => parseReservationInput(bookingSchema, { ...input, locale: "en-123-123" }), {
    code: "INVALID",
  });
  assert.throws(() => parseReservationInput(serviceSchema, { ...service, durationMinutes: 0 }), {
    code: "INVALID",
  });
  assert.throws(
    () => parseReservationInput(resourceSchema, { ...resource, exceptions: { "2026-02-30": [] } }),
    { code: "INVALID" },
  );
  assert.throws(
    () =>
      parseReservationInput(resourceSchema, {
        ...resource,
        weeklyHours: {
          1: [
            { start: "09:00", end: "12:00" },
            { start: "11:00", end: "13:00" },
          ],
        },
      }),
    { code: "INVALID" },
  );
});

void test("derived management keys stay stable, separate signatures and reject short root secrets", () => {
  const rootSecret = "s".repeat(32);
  const secret = deriveManagementSecret(rootSecret);
  assert.equal(secret, "iMxDiKto4tkwhAH5Xk7JL74c0N3lp3OZEjtGRlkfzDI");
  const token = signManagementLink("booking", 3, 1000, secret);
  assert.deepEqual(verifyManagementLink(token, deriveManagementSecret(rootSecret), 999), {
    id: "booking",
    version: 3,
  });
  for (const wrongKey of [rootSecret, deriveManagementSecret("x".repeat(32))])
    assert.throws(() => verifyManagementLink(token, wrongKey, 999), { code: "INVALID_LINK" });
  for (const shortSecret of ["", "s".repeat(31)])
    assert.throws(() => deriveManagementSecret(shortSecret), { code: "INVALID" });
});

await test("management signatures reject tampering and expire at the exact boundary", () => {
  const secret = "s".repeat(32);
  const token = signManagementLink("booking", 3, 1000, secret);
  assert.deepEqual(verifyManagementLink(token, secret, 999), { id: "booking", version: 3 });
  assert.throws(() => verifyManagementLink(token, secret, 1000), { code: "INVALID_LINK" });
  assert.throws(() => verifyManagementLink(token + "x", secret, 999), { code: "INVALID_LINK" });
  assert.throws(() => verifyManagementLink(token, "x".repeat(32), 999), { code: "INVALID_LINK" });
});

await test("year reads stay bounded, keep filters and deduplicate bookings across page boundaries", async () => {
  const range = {
    from: "2027-09-01T00:00:00Z",
    to: "2028-09-01T00:00:00Z",
    resourceId,
    serviceId,
    status: "confirmed",
  };
  const queries = [];
  const result = await loadReservationCalendar(
    {
      list: async (query) => {
        parseReservationInput(rangeSchema, query);
        queries.push(query);
        return [{ ...booking(), version: queries.length, outsideHours: false, emailFailed: false }];
      },
    },
    range,
  );
  assert.equal(queries.length, 9);
  assert.equal(Date.parse(queries[0].from), Date.parse(range.from));
  assert.equal(Date.parse(queries.at(-1).to), Date.parse(range.to));
  for (let i = 0; i < queries.length; i++) {
    assert.equal(queries[i].resourceId, resourceId);
    assert.equal(queries[i].serviceId, serviceId);
    assert.equal(queries[i].status, "confirmed");
    if (i) assert.equal(queries[i].from, queries[i - 1].to);
  }
  assert.equal(result.length, 1);
  assert.equal(result[0].version, 9);
  await assert.rejects(
    loadReservationCalendar(
      {
        list: async (query) => {
          if (query.from !== queries[0].from) throw new Error("Read failed");
          return [];
        },
      },
      range,
    ),
    /Read failed/,
  );
});

await test("overnight stays derive checkout, retain policy and reserve the entire buffered interval", () => {
  const c = structuredClone(config);
  c.mode = "stay";
  c.resources[0].weeklyHours = {};
  c.resources[0].blockedDates = [];
  c.services[0] = {
    ...service,
    mode: "stay",
    durationMinutes: undefined,
    arrivalStart: "15:00",
    arrivalEnd: "20:00",
    checkoutTime: "11:00",
    minNights: 1,
    maxNights: 30,
    bufferAfterMinutes: 120,
  };
  const stayInput = { ...input, startsAt: "2026-09-28T13:00:00.000Z", departureDate: "2026-10-01" };
  const stay = placeReservation(c, [], stayInput, now, "stay");
  assert.equal(stay.endsAt, "2026-10-01T09:00:00.000Z");
  assert.equal(stay.occupiedEnd, "2026-10-01T11:00:00.000Z");
  assert.equal(stay.mode, "stay");
  assert.equal(stay.nights, 3);
  assert.deepEqual(
    availableSlots(c, [stay], { serviceId, date: "2026-09-30", departureDate: "2026-10-02" }, now),
    [],
  );
  assert.ok(
    availableSlots(c, [stay], { serviceId, date: "2026-10-01", departureDate: "2026-10-02" }, now)
      .length,
  );
  assert.throws(
    () => placeReservation(c, [], { ...stayInput, departureDate: "2026-09-28" }, now, "bad"),
    { code: "INVALID" },
  );
  for (const departureDate of ["invalid", "2026-10-1", "2026-02-29", "2026-09-31"]) {
    assert.throws(
      () => availableSlots(c, [], { serviceId, date: "2026-09-28", departureDate }, now),
      { code: "INVALID" },
    );
    assert.throws(
      () => placeReservation(c, [], { ...stayInput, departureDate }, now, "bad", { staff: true }),
      { code: "INVALID" },
    );
  }
  c.services[0].checkoutTime = "09:00";
  const moved = placeReservation(
    c,
    [stay],
    { ...stayInput, departureDate: "2026-10-03" },
    now,
    "stay",
    { reservation: stay },
  );
  assert.equal(moved.endsAt, "2026-10-03T09:00:00.000Z");
  assert.equal(moved.policy.checkoutTime, "11:00");
});

await test("stay closures, overnight bounds, additive buffers and single-resource assignment", () => {
  const c = structuredClone(config);
  c.mode = "stay";
  c.services[0] = {
    ...service,
    mode: "stay",
    durationMinutes: undefined,
    arrivalStart: "00:00",
    arrivalEnd: "23:59",
    checkoutTime: "11:00",
    minNights: 1,
    maxNights: 3,
    bufferBeforeMinutes: 30,
    bufferAfterMinutes: 120,
  };
  c.resources[0] = { ...resource, weeklyHours: {}, blockedDates: [] };
  const request = { ...input, startsAt: "2026-09-28T13:00:00.000Z", departureDate: "2026-09-30" };
  const r = placeReservation(c, [], request, now, "stay");
  const query = { serviceId, date: "2026-09-30", departureDate: "2026-10-01" };
  assert.equal(availableSlots(c, [r], query, now)[0].startsAt, "2026-09-30T11:30:00.000Z");
  assert.throws(() => availableSlots(c, [], { ...query, departureDate: "2026-10-04" }, now), {
    code: "INVALID",
  });
  assert.throws(() => availableSlots(c, [], { serviceId, date: "2026-09-30" }, now), {
    code: "INVALID",
  });
  const blocked = {
    ...c.resources[0],
    blockedDates: [{ from: "2026-09-29", through: "2026-09-29" }],
  };
  assert.throws(() => assertResourceExceptions(c.resources[0], blocked, [r], c.settings.timeZone), {
    code: "CONFLICT",
  });
  c.resources[0] = blocked;
  assert.deepEqual(
    availableSlots(c, [], { serviceId, date: "2026-09-28", departureDate: "2026-09-30" }, now),
    [],
  );
  const second = {
    ...blocked,
    id: "10000000-0000-4000-8000-000000000002",
    blockedDates: [{ from: "2026-09-28", through: "2026-09-28" }],
  };
  c.resources.push(second);
  c.services[0].resourceIds.push(second.id);
  assert.throws(() => placeReservation(c, [], request, now, "no-split"), { code: "CONFLICT" });
  second.blockedDates = [];
  assert.equal(placeReservation(c, [], request, now, "assigned").resourceId, second.id);
  assert.throws(
    () =>
      placeReservation(config, [], { ...input, departureDate: "2026-09-29" }, now, "wrong-mode"),
    { code: "INVALID" },
  );
  assert.throws(
    () =>
      parseReservationInput(resourceSchema, {
        ...blocked,
        blockedDates: [{ from: "2026-10-01", through: "2026-09-30" }],
      }),
    { code: "INVALID" },
  );
  assert.throws(
    () => parseReservationInput(serviceSchema, { ...c.services[0], arrivalStart: "" }),
    { code: "INVALID" },
  );
});

await test("stay nights and checkout follow local dates through DST, leap days and year boundaries", () => {
  const c = structuredClone(config);
  c.mode = "stay";
  c.resources[0].weeklyHours = {};
  c.services[0] = {
    ...service,
    mode: "stay",
    durationMinutes: undefined,
    arrivalStart: "00:00",
    arrivalEnd: "23:59",
    checkoutTime: "11:00",
    minNights: 1,
    maxNights: 365,
    horizonDays: 365,
  };
  for (const [arrival, departure, before, expected, nights] of [
    [
      "2026-03-28T14:00:00.000Z",
      "2026-03-30",
      "2026-03-01T00:00:00.000Z",
      "2026-03-30T09:00:00.000Z",
      2,
    ],
    ["2026-10-24T13:00:00.000Z", "2026-10-26", now, "2026-10-26T10:00:00.000Z", 2],
    [
      "2028-02-28T14:00:00.000Z",
      "2028-03-01",
      "2028-02-01T00:00:00.000Z",
      "2028-03-01T10:00:00.000Z",
      2,
    ],
    ["2026-12-31T14:00:00.000Z", "2027-01-02", now, "2027-01-02T10:00:00.000Z", 2],
  ]) {
    const r = placeReservation(
      c,
      [],
      { ...input, startsAt: arrival, departureDate: departure },
      before,
      "stay",
    );
    assert.equal(r.endsAt, expected);
    assert.equal(r.nights, nights);
  }
  c.services[0].checkoutTime = "02:30";
  assert.deepEqual(
    availableSlots(
      c,
      [],
      { serviceId, date: "2026-03-28", departureDate: "2026-03-29" },
      "2026-03-01T00:00:00.000Z",
    ),
    [],
  );
  const fall = placeReservation(
    c,
    [],
    { ...input, startsAt: "2026-10-24T13:00:00.000Z", departureDate: "2026-10-25" },
    now,
    "fall",
  );
  assert.equal(fall.endsAt, "2026-10-25T01:30:00.000Z");
  const repeated = availableSlots(
    c,
    [],
    { serviceId, date: "2026-10-25", departureDate: "2026-10-26" },
    now,
  );
  assert.ok(repeated.some((s) => s.startsAt === "2026-10-25T00:30:00.000Z"));
  assert.ok(repeated.some((s) => s.startsAt === "2026-10-25T01:30:00.000Z"));
  c.services[0].horizonDays = 1;
  assert.ok(
    availableSlots(c, [], { serviceId, date: "2026-09-28", departureDate: "2026-10-10" }, now)
      .length,
  );
  assert.deepEqual(
    availableSlots(c, [], { serviceId, date: "2026-09-29", departureDate: "2026-10-10" }, now),
    [],
  );
});

void test("optimistic moves use the supplied slot and preserve authority and the original booking", () => {
  const original = booking();
  const snapshot = structuredClone(original);
  const slot = { startsAt: "2026-09-28T11:00:00.000Z", endsAt: "2026-09-28T11:45:00.000Z" };
  const preview = previewReservationMove(
    original,
    { version: original.version, startsAt: slot.startsAt },
    slot,
    "Europe/Zurich",
    "Without preference",
  );
  assert.equal(preview.startsAt, slot.startsAt);
  assert.equal(preview.endsAt, slot.endsAt);
  assert.equal(preview.occupiedEnd, "2026-09-28T12:00:00.000Z");
  assert.equal(preview.resourceId, "");
  assert.equal(preview.resourceName, "Without preference");
  assert.equal(preview.version, original.version);
  assert.deepEqual(original, snapshot);
  const stay = {
    ...original,
    mode: "stay",
    policy: { ...original.policy, mode: "stay", approval: "manual" },
  };
  const movedStay = previewReservationMove(
    stay,
    { startsAt: "2026-10-24T13:00:00.000Z", departureDate: "2026-10-26", resourceId: "room" },
    { startsAt: "2026-10-24T13:00:00.000Z", endsAt: "2026-10-26T10:00:00.000Z" },
    "Europe/Zurich",
    "Room",
  );
  assert.equal(movedStay.status, "pending");
  assert.equal(movedStay.nights, 2);
  assert.equal(movedStay.resourceId, "room");
  assert.equal(movedStay.departureDate, "2026-10-26");
});

await test("month and year counts share local stay boundaries, leap days and midnight checkout", () => {
  const stay = {
    ...booking(),
    mode: "stay",
    startsAt: "2028-02-28T23:30:00Z",
    endsAt: "2028-03-01T10:00:00Z",
    occupiedEnd: "2028-03-02T10:00:00Z",
  };
  assert.deepEqual(
    [...reservationDayCounts([stay], "Europe/Zurich")],
    [
      ["2028-02-29", 1],
      ["2028-03-01", 1],
    ],
  );
  assert.deepEqual(
    [...reservationDayCounts([{ ...stay, endsAt: "2028-02-29T23:00:00Z" }], "Europe/Zurich")],
    [["2028-02-29", 1]],
  );
  assert.deepEqual(
    [...reservationDayCounts([{ ...stay, mode: "appointment" }], "Europe/Zurich")],
    [["2028-02-29", 1]],
  );
  assert.deepEqual([...reservationDayCounts([], "Europe/Zurich")], []);
});

await test("all-date list pages validate input, retain all statuses and filter before paging", async () => {
  const { createReservationsMock } = await import("../src/showroom/reservations-mock.ts");
  const mock = createReservationsMock();
  mock.populateList();
  const first = await mock.adminClient.listPage({ page: 1 });
  const second = await mock.adminClient.listPage({ page: 2 });
  assert.equal(first.items.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 5);
  assert.equal(second.hasMore, false);
  const all = [...first.items, ...second.items];
  assert.equal(new Set(all.map((row) => row.id)).size, 25);
  assert.equal(new Set(all.map((row) => row.status)).size, 4);
  assert.ok(all[0].startsAt < new Date().toISOString());
  assert.ok(all.at(-1).startsAt > new Date().toISOString());
  assert.deepEqual(
    all.map((row) => row.startsAt),
    all.map((row) => row.startsAt).sort((a, b) => a.localeCompare(b)),
  );
  const filtered = await mock.adminClient.listPage({
    page: 1,
    status: "pending",
    resourceId,
    serviceId,
  });
  assert.equal(filtered.items.length, 6);
  assert.ok(filtered.items.every((row) => row.status === "pending"));
  assert.deepEqual(await mock.adminClient.listPage({ page: 3 }), { items: [], hasMore: false });
  for (const query of [
    {},
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { page: 1_000_001 },
    { page: "1" },
    { page: 1, status: "invalid" },
    { page: 1, resourceId: "invalid" },
  ]) {
    await assert.rejects(mock.adminClient.listPage(query), { code: "INVALID" });
  }
});
