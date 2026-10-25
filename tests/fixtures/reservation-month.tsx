import { createRoot } from "react-dom/client";
import { Temporal } from "temporal-polyfill";

import { ReservationNewPage } from "@/components/plugins/reservations/admin";
import { ReservationBookingPage } from "@/components/plugins/reservations/public";
import type {
  ReservationAvailabilityQuery,
  ReservationMonthAvailabilityQuery,
} from "@/components/plugins/reservations/types";

import { createReservationsMock } from "../../src/showroom/reservations-mock";

import "../../src/styles/globals.css";

const store = createReservationsMock();
const config = await store.adminClient.configuration();
await store.adminClient.saveService({
  ...config.services[0],
  id: "20000000-0000-4000-8000-000000000002",
  version: 0,
  name: "Second appointment",
});
const params = new URLSearchParams(location.search);
const staff = params.has("staff");
const legacy = params.has("legacy");
const daily: ReservationAvailabilityQuery[] = [];
const requests: {
  query: ReservationMonthAvailabilityQuery;
  resolve: (value: Record<string, boolean>) => void;
  reject: () => void;
}[] = [];
const source = staff ? store.adminClient : store.publicClient;
const overrides = {
  availability: (query: ReservationAvailabilityQuery) => {
    daily.push(query);
    return source.availability(query);
  },
  monthAvailability: legacy
    ? undefined
    : (query: ReservationMonthAvailabilityQuery) =>
        new Promise<Record<string, boolean>>((resolve, reject) => {
          requests.push({ query, resolve, reject: () => reject(new Error("Month unavailable")) });
        }),
};
declare global {
  interface Window {
    monthTest: {
      daily: typeof daily;
      requests: typeof requests;
      resolve: (index: number, available: boolean) => void;
    };
  }
}
window.monthTest = {
  daily,
  requests,
  resolve: (index, available) => {
    const request = requests[index];
    const month = Temporal.PlainDate.from(request.query.month);
    const from = month.subtract({ days: month.dayOfWeek - 1 });
    request.resolve(
      Object.fromEntries(
        Array.from({ length: 42 }, (_, i) => [from.add({ days: i }).toString(), available]),
      ),
    );
  },
};
createRoot(document.getElementById("factory-reservation-month-fixture")!).render(
  staff ? (
    <ReservationNewPage
      client={{ ...store.adminClient, ...overrides }}
      locale="en"
      initialDate={store.initialDate}
      backHref="#"
      onBooked={() => {}}
    />
  ) : (
    <ReservationBookingPage
      client={{ ...store.publicClient, ...overrides }}
      locale="en"
      initialDate={store.initialDate}
    />
  ),
);
