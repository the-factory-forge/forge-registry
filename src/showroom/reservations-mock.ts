import { Temporal } from "temporal-polyfill";

import {
  activeReservation,
  assertResourceExceptions,
  assertVersion,
  availableSlots,
  bookingSchema,
  canCustomerChange,
  catalog,
  changeStatus,
  fitsResource,
  parseReservationInput,
  placeReservation,
  rangeSchema,
  reservationPolicyDefaults,
  reservationStayPolicyDefaults,
  resourceSchema,
  serviceSchema,
  settingsSchema,
} from "@/components/plugins/reservations/model";
import {
  ReservationError,
  type Reservation,
  type ReservationConfiguration,
  type ReservationManagementClient,
  type ReservationsAdminClient,
  type ReservationsPublicClient,
} from "@/components/plugins/reservations/types";

export function createReservationsMock() {
  const now = new Date().toISOString();
  let date = Temporal.Instant.from(now)
    .toZonedDateTimeISO("Europe/Zurich")
    .toPlainDate()
    .add({ days: 2 });
  while (date.dayOfWeek > 5) date = date.add({ days: 1 });
  const initialDate = date.toString();
  let scenario: "hairdresser" | "clinic" | "apartment" = "hairdresser";
  let config: ReservationConfiguration;
  let reservations: Reservation[] = [];
  const requests = new Map<string, { input: string; id: string }>();
  let fail = false,
    slow = false,
    revision = 0,
    generation = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    revision++;
    listeners.forEach((fn) => fn());
  };
  const currentTime = () => new Date().toISOString();
  const check = async (mutation = false) => {
    if (slow) await new Promise((resolve) => setTimeout(resolve, 900));
    if (mutation && fail) throw new ReservationError("STORAGE");
  };
  const find = (id: string) => {
    const r = reservations.find((r) => r.id === id);
    if (!r) throw new ReservationError("NOT_FOUND");
    return r;
  };
  const replace = (r: Reservation) => {
    reservations = reservations.map((old) => (old.id === r.id ? r : old));
    emit();
    return structuredClone(r);
  };
  function seed(empty = false) {
    const resources = ["Alex", "Sam"].map((name, i) => ({
      id: `10000000-0000-4000-8000-00000000000${i + 1}`,
      version: 1,
      name:
        scenario === "apartment"
          ? `Apartment ${i + 1}`
          : scenario === "clinic"
            ? `Dr. ${name}`
            : name,
      active: true,
      archived: false,
      weeklyHours:
        scenario === "apartment"
          ? {}
          : Object.fromEntries(
              [1, 2, 3, 4, 5].map((day) => [
                String(day),
                [
                  { start: "09:00", end: "12:00" },
                  { start: "13:00", end: "17:00" },
                ],
              ]),
            ),
      exceptions: {},
      blockedDates: [],
    }));
    config = {
      mode: scenario === "apartment" ? "stay" : "appointment",
      settings: { version: 1, timeZone: "Europe/Zurich", publicBookingEnabled: true },
      resources,
      services: [
        {
          ...reservationPolicyDefaults,
          id: "20000000-0000-4000-8000-000000000001",
          version: 1,
          name:
            scenario === "apartment"
              ? "Apartment stay / Séjour"
              : scenario === "clinic"
                ? "Consultation"
                : "Haircut / Coupe",
          description:
            scenario === "apartment"
              ? "A private apartment with time reserved for cleaning after checkout."
              : scenario === "clinic"
                ? "A consultation with an available practitioner."
                : "A haircut with time reserved for cleaning between appointments.",
          ...(scenario === "apartment"
            ? {
                ...reservationStayPolicyDefaults,
                arrivalStart: "15:00",
                arrivalEnd: "20:00",
                checkoutTime: "11:00",
                bufferAfterMinutes: 120,
              }
            : { durationMinutes: 45, bufferAfterMinutes: 15 }),
          approval: scenario === "clinic" ? "manual" : "automatic",
          active: true,
          archived: false,
          resourceIds: resources.map((r) => r.id),
        },
      ],
    };
    reservations = [];
    requests.clear();
    if (!empty) {
      const start = date
        .toPlainDateTime(scenario === "apartment" ? "15:00" : "10:00")
        .toZonedDateTime("Europe/Zurich")
        .toInstant()
        .toString({ fractionalSecondDigits: 3 });
      reservations.push(
        placeReservation(
          config,
          [],
          {
            requestId: crypto.randomUUID(),
            serviceId: config.services[0].id,
            resourceId: resources[0].id,
            startsAt: start,
            ...(scenario === "apartment"
              ? { departureDate: date.add({ days: 3 }).toString() }
              : {}),
            customer: { name: "Jamie Taylor", email: "jamie@example.test", phone: "" },
            locale: "en",
          },
          now,
          "30000000-0000-4000-8000-000000000001",
        ),
      );
    }
  }
  seed();
  async function book(input: Parameters<ReservationsPublicClient["book"]>[0], staff = false) {
    await check(true);
    const value = parseReservationInput(bookingSchema, input);
    const existing = requests.get(value.requestId);
    if (existing) {
      if (existing.input !== JSON.stringify(value)) throw new ReservationError("CONFLICT");
      return structuredClone(find(existing.id));
    }
    const r = placeReservation(config, reservations, value, currentTime(), crypto.randomUUID(), {
      staff,
    });
    reservations.push(r);
    requests.set(value.requestId, { input: JSON.stringify(value), id: r.id });
    emit();
    return structuredClone(r);
  }
  async function move(
    id: string,
    input: { startsAt: string; resourceId?: string; version: number; departureDate?: string },
    staff = false,
  ) {
    await check(true);
    const current = find(id);
    assertVersion(current.version, input.version);
    if (!staff && !canCustomerChange(current, currentTime())) throw new ReservationError("CUTOFF");
    if (!activeReservation(current)) throw new ReservationError("CONFLICT");
    return replace(
      placeReservation(
        config,
        reservations,
        {
          requestId: crypto.randomUUID(),
          serviceId: current.serviceId,
          resourceId: input.resourceId,
          startsAt: input.startsAt,
          departureDate: input.departureDate,
          customer: current.customer,
          locale: current.locale,
        },
        currentTime(),
        id,
        { staff, reservation: current },
      ),
    );
  }
  const publicClient: ReservationsPublicClient = {
    catalog: async () => {
      await check();
      return structuredClone(catalog(config));
    },
    availability: async (query) => {
      await check();
      return availableSlots(config, reservations, query, currentTime());
    },
    book: (input) => book(input),
  };
  const adminClient: ReservationsAdminClient = {
    configuration: async () => {
      await check();
      return structuredClone(config);
    },
    list: async (input) => {
      await check();
      const query = parseReservationInput(rangeSchema, input);
      return structuredClone(
        reservations
          .filter(
            (r) =>
              r.startsAt < query.to &&
              r.occupiedEnd > query.from &&
              (!query.resourceId || r.resourceId === query.resourceId) &&
              (!query.serviceId || r.serviceId === query.serviceId) &&
              (!query.status || r.status === query.status),
          )
          .map((r) => ({
            ...r,
            emailFailed: false,
            outsideHours:
              activeReservation(r) &&
              !fitsResource(
                config.resources.find((v) => v.id === r.resourceId)!,
                r.occupiedStart,
                r.occupiedEnd,
                config.settings.timeZone,
                r.mode,
              ),
          })),
      );
    },
    availability: async (query) => {
      await check();
      return availableSlots(config, reservations, query, currentTime(), {
        staff: true,
        reservation: query.reservationId ? find(query.reservationId) : undefined,
      });
    },
    book: (input) => book(input, true),
    reschedule: (id, input) => move(id, input, true),
    setStatus: async (id, version, status) => {
      await check(true);
      const r = find(id);
      assertVersion(r.version, version);
      return replace(changeStatus(r, status, currentTime()));
    },
    saveSettings: async (input) => {
      await check(true);
      const value = parseReservationInput(settingsSchema, input);
      assertVersion(config.settings.version, value.version);
      config.settings = { ...value, version: value.version + 1 };
      emit();
      return structuredClone(config.settings);
    },
    saveService: async (input) => {
      await check(true);
      const value = parseReservationInput(serviceSchema, input);
      if ((value.mode ?? "appointment") !== config.mode)
        throw new ReservationError("MODE_MISMATCH");
      assertVersion(config.services.find((s) => s.id === value.id)?.version ?? 0, value.version);
      const next = {
        ...value,
        version: value.version + 1,
        active: value.archived ? false : value.active,
      };
      config.services = [...config.services.filter((s) => s.id !== next.id), next];
      emit();
      return structuredClone(next);
    },
    saveResource: async (input) => {
      await check(true);
      const value = parseReservationInput(resourceSchema, input);
      const old = config.resources.find((r) => r.id === value.id);
      assertVersion(old?.version ?? 0, value.version);
      assertResourceExceptions(old, value, reservations, config.settings.timeZone);
      const next = {
        ...value,
        version: value.version + 1,
        active: value.archived ? false : value.active,
      };
      config.resources = [...config.resources.filter((r) => r.id !== next.id), next];
      emit();
      return structuredClone(next);
    },
    retryEmail: async () => {
      await check(true);
    },
    revokeLink: async (id, version) => {
      await check(true);
      const r = find(id);
      assertVersion(r.version, version);
      return replace({ ...r, version: version + 1 });
    },
  };
  const managementClients = new Map<string, ReservationManagementClient>();
  function managementClient(id: string): ReservationManagementClient {
    let client = managementClients.get(id);
    if (!client) {
      client = {
        get: async () => {
          await check();
          const r = find(id);
          return {
            reservation: structuredClone(r),
            timeZone: config.settings.timeZone,
            canChange: canCustomerChange(r, currentTime()),
            resources: catalog(config).resources,
          };
        },
        availability: async (query) => {
          await check();
          const r = find(id);
          return availableSlots(
            config,
            reservations,
            { ...query, serviceId: r.serviceId },
            currentTime(),
            { reservation: r },
          );
        },
        cancel: async (version) => {
          await check(true);
          const r = find(id);
          assertVersion(r.version, version);
          if (!canCustomerChange(r, currentTime())) throw new ReservationError("CUTOFF");
          return replace(changeStatus(r, "cancelled", currentTime()));
        },
        reschedule: (input) => move(id, input),
      };
      managementClients.set(id, client);
    }
    return client;
  }
  return {
    publicClient,
    adminClient,
    managementClient,
    initialDate,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot: () => revision,
    get reservations() {
      return reservations;
    },
    get fail() {
      return fail;
    },
    get slow() {
      return slow;
    },
    get scenario() {
      return scenario;
    },
    get generation() {
      return generation;
    },
    setFail(value: boolean) {
      fail = value;
      emit();
    },
    setSlow(value: boolean) {
      slow = value;
      emit();
    },
    reset(next: "hairdresser" | "clinic" | "apartment" = scenario, empty = false) {
      generation++;
      scenario = next;
      seed(empty);
      managementClients.clear();
      emit();
    },
  };
}
