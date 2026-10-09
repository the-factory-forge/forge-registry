"use client";

import { RefreshCwIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Temporal } from "temporal-polyfill";

import {
  getReservationLabels,
  type ReservationLabels,
} from "@/components/plugins/reservations/labels";
import { addMinutes, localDate, stayNights } from "@/components/plugins/reservations/model";
import type {
  Reservation,
  ReservationCatalog,
  ReservationManagementClient,
  ReservationsPublicClient,
  ReservationSlot,
} from "@/components/plugins/reservations/types";
import {
  buttonClass,
  primaryClass,
  fieldClass,
  pageClass,
  panelClass,
  Field,
  DatePicker,
  StayDatePicker,
  ErrorNotice,
  formatDateTime,
  Modal,
  ReservationSummary,
  SlotPicker,
  useReservationAction,
  useReservationLoad,
} from "@/components/plugins/reservations/ui";
import { cn } from "@/components/utils/cn";

export interface ReservationBookingPageProps {
  client: ReservationsPublicClient;
  locale?: string;
  labels?: Partial<ReservationLabels>;
  initialDate?: string;
  onBooked?: (reservation: Reservation) => void;
  className?: string;
}

export function ReservationBookingPage({
  client,
  locale = "en",
  labels: overrides,
  initialDate,
  onBooked,
  className,
}: ReservationBookingPageProps) {
  const load = useCallback(() => client.catalog(), [client]);
  const data = useReservationLoad(load);
  const labels = getReservationLabels(overrides, data.value?.mode);
  const [receipt, setReceipt] = useState<Reservation>();
  return (
    <section className={cn(pageClass, className)}>
      <h1 className="font-serif text-3xl font-semibold">{labels.booking}</h1>
      <ErrorNotice error={data.error} labels={labels} />
      {data.error ? (
        <button className={buttonClass} onClick={data.reload}>
          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
          {labels.refresh}
        </button>
      ) : !data.value ? (
        <output className="block">{labels.loading}</output>
      ) : receipt ? (
        <div className={cn(panelClass, "space-y-5")}>
          <output className="block">{labels.booked}</output>
          <ReservationSummary reservation={receipt} locale={locale} labels={labels} />
          <button className={buttonClass} onClick={() => setReceipt(undefined)}>
            {labels.another}
          </button>
        </div>
      ) : !data.value.settings.publicBookingEnabled ? (
        <output className="block">{labels.unavailable}</output>
      ) : !data.value.services.length ? (
        <output className="block">{labels.emptyServices}</output>
      ) : (
        <BookingForm
          client={client}
          catalog={data.value}
          labels={labels}
          locale={locale}
          initialDate={initialDate}
          onBooked={(value) => {
            setReceipt(value);
            onBooked?.(value);
          }}
        />
      )}
    </section>
  );
}

/** Also used by the staff's short create dialog. The host binds an authorized client. */
export function BookingForm({
  client,
  catalog,
  labels,
  locale,
  initialDate,
  onBooked,
  staff = false,
}: {
  client: ReservationsPublicClient;
  catalog: ReservationCatalog;
  labels: ReservationLabels;
  locale: string;
  initialDate?: string;
  onBooked: (reservation: Reservation) => void;
  staff?: boolean;
}) {
  const [serviceId, setServiceId] = useState(catalog.services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(
    () => initialDate ?? localDate(new Date().toISOString(), catalog.settings.timeZone),
  );
  const [departureDate, setDepartureDate] = useState(() =>
    Temporal.PlainDate.from(date)
      .add({ days: catalog.services[0]?.mode === "stay" ? catalog.services[0].minNights : 1 })
      .toString(),
  );
  const [startsAt, setStartsAt] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [reviewing, setReviewing] = useState(false);
  const request = useRef<{ input: string; id: string } | null>(null);
  const action = useReservationAction();
  const service = catalog.services.find((s) => s.id === serviceId);
  const stay = catalog.mode === "stay";
  const loadSlots = useCallback(
    () =>
      client.availability({
        serviceId,
        resourceId: resourceId || undefined,
        date,
        ...(stay ? { departureDate } : {}),
      }),
    [client, serviceId, resourceId, date, stay, departureDate],
  );
  const slots = useReservationLoad(loadSlots);
  const selectedSlot = slots.value?.find((slot) => slot.startsAt === startsAt);
  const zone = catalog.settings.timeZone;
  const resource = catalog.resources.find((r) => r.id === resourceId);
  const selectDate = (value: string) => {
    setDate(value);
    setStartsAt("");
    setReviewing(false);
  };
  if (!service) return <output className="block">{labels.emptyServices}</output>;
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!reviewing && !staff) {
          setReviewing(true);
          return;
        }
        void action.run(async () => {
          const value = {
            serviceId,
            resourceId: resourceId || undefined,
            startsAt,
            ...(stay ? { departureDate } : {}),
            customer,
            locale,
          };
          const fingerprint = JSON.stringify(value);
          if (request.current?.input !== fingerprint)
            request.current = { input: fingerprint, id: crypto.randomUUID() };
          try {
            onBooked(await client.book({ ...value, requestId: request.current.id }));
          } catch (error) {
            setReviewing(false);
            slots.reload();
            throw error;
          }
        });
      }}
    >
      <ErrorNotice error={action.error} labels={labels} />
      {!reviewing ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={labels.service}>
              <select
                className={fieldClass}
                value={serviceId}
                disabled={action.busy}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setResourceId("");
                  setStartsAt("");
                }}
              >
                {catalog.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={labels.resource}>
              <select
                className={fieldClass}
                value={resourceId}
                disabled={action.busy}
                onChange={(e) => {
                  setResourceId(e.target.value);
                  setStartsAt("");
                }}
              >
                <option value="">{labels.anyResource}</option>
                {catalog.resources
                  .filter((r) => service.resourceIds.includes(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          {service.description && (
            <p className="text-sm text-muted-foreground">{service.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {labels.timeZone}: {zone} ·{" "}
            {service.mode === "stay"
              ? `${labels.nights}: ${service.minNights}–${service.maxNights} · ${labels.checkoutTime}: ${service.checkoutTime}`
              : `${labels.duration}: ${service.durationMinutes}`}
          </p>
          <div className={cn(!staff && "grid gap-6 md:grid-cols-2")}>
            {service.mode === "stay" ? (
              <StayDatePicker
                arrival={date}
                departure={departureDate}
                minNights={service.minNights}
                labels={labels}
                locale={locale}
                onChange={(arrival, departure) => {
                  selectDate(arrival);
                  setDepartureDate(departure);
                }}
              />
            ) : staff ? (
              <Field label={labels.date}>
                <input
                  type="date"
                  required
                  className={fieldClass}
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) selectDate(e.target.value);
                  }}
                />
              </Field>
            ) : (
              <div className={panelClass}>
                <DatePicker date={date} onChange={selectDate} labels={labels} locale={locale} />
              </div>
            )}
            <div className={cn(!staff && panelClass, "space-y-4")}>
              <ErrorNotice error={slots.error} labels={labels} />
              {slots.error ? (
                <button type="button" className={buttonClass} onClick={slots.reload}>
                  <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                  {labels.refresh}
                </button>
              ) : !slots.value ? (
                <output className="block">{labels.loading}</output>
              ) : (
                <SlotPicker
                  slots={slots.value}
                  selected={startsAt}
                  onChange={setStartsAt}
                  labels={labels}
                  locale={locale}
                  zone={zone}
                />
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["name", "email", "phone"] as const).map((field) => (
              <Field key={field} label={labels[field]}>
                <input
                  className={fieldClass}
                  type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                  required={field !== "phone"}
                  maxLength={field === "email" ? 254 : field === "name" ? 120 : 40}
                  autoComplete={field === "phone" ? "tel" : field}
                  value={customer[field]}
                  disabled={action.busy}
                  onChange={(e) => setCustomer({ ...customer, [field]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </>
      ) : (
        <div className={cn(panelClass, "space-y-3")}>
          <h2 className="text-xl font-semibold">{service.name}</h2>
          <p>{resource?.name ?? labels.anyResource}</p>
          <p>
            {stay && `${labels.arrivalDate}: `}
            {formatDateTime(startsAt, locale, zone)} · {zone}
          </p>
          <p>
            {service.mode === "stay" ? (
              <>
                {labels.departureDate}:{" "}
                {selectedSlot && formatDateTime(selectedSlot.endsAt, locale, zone)} ·{" "}
                {labels.nights}: {stayNights(date, departureDate)}
              </>
            ) : (
              <>
                {labels.duration}: {service.durationMinutes}
              </>
            )}
          </p>
          <p>
            {customer.name} · {customer.email}
          </p>
        </div>
      )}
      {startsAt && (
        <p className="text-sm">
          {labels.cancellationDeadline}:{" "}
          {formatDateTime(addMinutes(startsAt, -service.cancellationMinutes), locale, zone)}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {service.approval === "manual" ? labels.approvalRequired : labels.automaticApproval}
      </p>
      <div className="flex flex-wrap gap-3">
        {reviewing && (
          <button
            type="button"
            className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
            disabled={action.busy}
            onClick={() => setReviewing(false)}
          >
            {labels.back}
          </button>
        )}
        <button
          type="submit"
          className={primaryClass}
          disabled={
            !startsAt ||
            action.busy ||
            (!reviewing && !slots.value?.some((s) => s.startsAt === startsAt))
          }
        >
          {action.busy ? labels.saving : reviewing || staff ? labels.book : labels.review}
        </button>
      </div>
    </form>
  );
}

export interface ReservationManagePageProps {
  client: ReservationManagementClient;
  locale?: string;
  labels?: Partial<ReservationLabels>;
  className?: string;
}

export function ReservationManagePage({
  client,
  locale = "en",
  labels: overrides,
  className,
}: ReservationManagePageProps) {
  const load = useCallback(() => client.get(), [client]);
  const data = useReservationLoad(load);
  const labels = getReservationLabels(overrides, data.value?.reservation.mode);
  const [dialog, setDialog] = useState<"cancel" | "move">();
  const action = useReservationAction();
  const r = data.value?.reservation;
  const availability = useCallback(
    (query: { date: string; resourceId?: string; departureDate?: string }) =>
      client.availability(query),
    [client],
  );
  const reschedule = useCallback(
    (input: Parameters<ReservationManagementClient["reschedule"]>[0]) => client.reschedule(input),
    [client],
  );
  return (
    <section className={cn(pageClass, "max-w-3xl", className)}>
      <h1 className="font-serif text-3xl font-semibold">{labels.manage}</h1>
      <ErrorNotice error={data.error ?? action.error} labels={labels} />
      {data.error ? (
        <button className={buttonClass} onClick={data.reload}>
          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
          {labels.refresh}
        </button>
      ) : !r ? (
        <output className="block">{labels.loading}</output>
      ) : (
        <div className={cn(panelClass, "space-y-5")}>
          <ReservationSummary reservation={r} locale={locale} labels={labels} />
          {data.value?.canChange ? (
            <div className="flex flex-wrap gap-3">
              <button className={buttonClass} onClick={() => setDialog("move")}>
                {labels.reschedule}
              </button>
              <button className={buttonClass} onClick={() => setDialog("cancel")}>
                {labels.cancel}
              </button>
            </div>
          ) : (
            (r.status === "pending" || r.status === "confirmed") && (
              <p className="text-sm text-muted-foreground">{labels.cutoff}</p>
            )
          )}
          {dialog === "cancel" && (
            <Modal
              title={labels.cancel}
              description={labels.cancelConfirm}
              onClose={() => setDialog(undefined)}
              busy={action.busy}
            >
              <ErrorNotice error={action.error} labels={labels} />
              <div className="flex flex-wrap gap-3">
                <button
                  className={buttonClass}
                  disabled={action.busy}
                  onClick={() => setDialog(undefined)}
                >
                  {labels.keep}
                </button>
                <button
                  className={primaryClass}
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      await client.cancel(r.version);
                      setDialog(undefined);
                      data.reload();
                    });
                  }}
                >
                  {labels.cancel}
                </button>
              </div>
            </Modal>
          )}
          {dialog === "move" && (
            <RescheduleDialog
              reservation={r}
              timeZone={data.value?.timeZone ?? r.timeZone}
              resources={data.value?.resources ?? []}
              labels={labels}
              locale={locale}
              availability={availability}
              onSave={reschedule}
              onClose={() => setDialog(undefined)}
              onSaved={() => {
                setDialog(undefined);
                data.reload();
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

export function RescheduleDialog({
  reservation,
  timeZone,
  resources,
  labels,
  locale,
  availability,
  onSave,
  onSaved,
  onClose,
}: {
  reservation: Reservation;
  timeZone: string;
  resources: { id: string; name: string }[];
  labels: ReservationLabels;
  locale: string;
  availability: (query: {
    date: string;
    resourceId?: string;
    departureDate?: string;
  }) => Promise<ReservationSlot[]>;
  onSave: ReservationManagementClient["reschedule"];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => localDate(reservation.startsAt, timeZone));
  const stay = reservation.policy.mode === "stay";
  const [departureDate, setDepartureDate] = useState(() => localDate(reservation.endsAt, timeZone));
  const [resourceId, setResourceId] = useState(
    resources.some((r) => r.id === reservation.resourceId) ? reservation.resourceId : "",
  );
  const [startsAt, setStartsAt] = useState("");
  const load = useCallback(
    () =>
      availability({
        date,
        resourceId: resourceId || undefined,
        ...(stay ? { departureDate } : {}),
      }),
    [availability, date, resourceId, stay, departureDate],
  );
  const slots = useReservationLoad(load);
  const action = useReservationAction();
  return (
    <Modal
      title={labels.reschedule}
      description={
        reservation.policy.approval === "manual" ? labels.moveWarning : labels.automaticApproval
      }
      onClose={onClose}
      busy={action.busy}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            try {
              await onSave({
                version: reservation.version,
                startsAt,
                ...(stay ? { departureDate } : {}),
                resourceId: resourceId || undefined,
              });
              onSaved();
            } catch (error) {
              slots.reload();
              throw error;
            }
          });
        }}
      >
        <ErrorNotice error={action.error ?? slots.error} labels={labels} />
        <Field label={labels.resource}>
          <select
            value={resourceId}
            className={fieldClass}
            onChange={(e) => {
              setResourceId(e.target.value);
              setStartsAt("");
            }}
          >
            <option value="">{labels.anyResource}</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        {reservation.policy.mode === "stay" ? (
          <StayDatePicker
            arrival={date}
            departure={departureDate}
            minNights={reservation.policy.minNights}
            labels={labels}
            locale={locale}
            onChange={(arrival, departure) => {
              setDate(arrival);
              setDepartureDate(departure);
              setStartsAt("");
            }}
          />
        ) : (
          <Field label={labels.date}>
            <input
              className={fieldClass}
              required
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setStartsAt("");
                }
              }}
            />
          </Field>
        )}
        <p className="text-sm text-muted-foreground">
          {timeZone}
          {reservation.policy.mode === "stay" &&
            ` · ${labels.checkoutTime}: ${reservation.policy.checkoutTime} · ${labels.nights}: ${stayNights(date, departureDate)}`}
        </p>
        {slots.value ? (
          <SlotPicker
            slots={slots.value}
            selected={startsAt}
            onChange={setStartsAt}
            locale={locale}
            labels={labels}
            zone={timeZone}
          />
        ) : (
          !slots.error && <output className="block">{labels.loading}</output>
        )}
        {!!slots.error && (
          <button type="button" className={buttonClass} onClick={slots.reload}>
            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.refresh}
          </button>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} disabled={action.busy} onClick={onClose}>
            {labels.close}
          </button>
          <button
            className={primaryClass}
            disabled={
              !startsAt || action.busy || !slots.value?.some((s) => s.startsAt === startsAt)
            }
          >
            {labels.saveMove}
          </button>
        </div>
      </form>
    </Modal>
  );
}
