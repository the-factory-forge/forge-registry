"use client";

import FullCalendar, { useCalendarController, type DatesSetInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ComponentType } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import {
  getReservationLabels,
  type ReservationLabels,
} from "@/components/plugins/reservations/labels";
import {
  catalog,
  loadReservationCalendar,
  localDate,
  previewReservationMove,
} from "@/components/plugins/reservations/model";
import { BookingForm, RescheduleDialog } from "@/components/plugins/reservations/public";
import type {
  ReservationAdminRecord,
  ReservationRange,
  ReservationSlot,
  ReservationStatus,
  ReservationsAdminClient,
  ReservationsPublicClient,
} from "@/components/plugins/reservations/types";
import {
  buttonClass,
  primaryClass,
  fieldClass,
  pageClass,
  Field,
  ErrorNotice,
  Modal,
  ReservationSummary,
  useReservationAction,
  useReservationLoad,
} from "@/components/plugins/reservations/ui";
import { ReservationYearView } from "@/components/plugins/reservations/year";
import { cn } from "@/components/utils/cn";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

import "./calendar.css";

const subscribe = () => () => {};
const mobileSnapshot = () => window.matchMedia("(max-width: 639px)").matches;
function subscribeMobile(callback: () => void) {
  const query = window.matchMedia("(max-width: 639px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export interface ReservationsCalendarProps {
  client: ReservationsAdminClient;
  locale?: string;
  labels?: Partial<ReservationLabels>;
  initialDate?: string;
  settingsHref?: string;
  canManage?: boolean;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}

export function ReservationsCalendar({
  client,
  locale = "en",
  labels: overrides,
  initialDate,
  settingsHref,
  canManage = true,
  className,
  linkComponent: HostLink = Link,
}: ReservationsCalendarProps) {
  const calendar = useCalendarController();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [view, setView] = useState("");
  const [range, setRange] = useState<ReservationRange>(() => {
    const from = initialDate ? new Date(`${initialDate}T00:00:00Z`) : new Date();
    return { from: from.toISOString(), to: new Date(from.getTime() + 7 * 86400000).toISOString() };
  });
  const [selectedRecord, setSelected] = useState<ReservationAdminRecord>();
  const [dialog, setDialog] = useState<"new" | "move" | "cancelled" | "rejected" | "link">();
  const load = useCallback(() => client.configuration(), [client]);
  const config = useReservationLoad(load);
  const labels = getReservationLabels(overrides, config.value?.mode);
  const timeZone = config.value?.settings.timeZone ?? "UTC";
  const loadBookings = useCallback(() => loadReservationCalendar(client, range), [client, range]);
  const data = useReservationLoad(loadBookings);
  const optimistic = useOptimisticAction(data.value, loadBookings);
  const bookings = optimistic.value;
  const selected = bookings?.find((row) => row.id === selectedRecord?.id) ?? selectedRecord;
  async function setStatus(id: string, version: number, status: ReservationStatus) {
    await optimistic.run(
      (rows) => rows?.map((row) => (row.id === id ? { ...row, status } : row)),
      async () => {
        const saved = await client.setStatus(id, version, status);
        data.setValue((rows) => rows.map((row) => (row.id === id ? { ...row, ...saved } : row)));
      },
    );
  }
  const action = useReservationAction();
  const refresh = () => {
    data.reload();
    setSelected(undefined);
    setDialog(undefined);
  };
  const datesSet = useCallback((info: DatesSetInfo) => {
    setView(info.view.type);
    setRange((r) => {
      const from = info.start.toISOString(),
        to = info.end.toISOString();
      return r.from === from && r.to === to ? r : { ...r, from, to };
    });
  }, []);
  const staffClient = useMemo<ReservationsPublicClient>(
    () => ({
      catalog: async () => catalog(await client.configuration()),
      availability: (q) => client.availability(q),
      book: (input) => client.book(input),
    }),
    [client],
  );
  const moveAvailability = useCallback(
    (query: { date: string; resourceId?: string; departureDate?: string }) =>
      client.availability({
        ...query,
        serviceId: selected?.serviceId ?? "",
        reservationId: selected?.id,
      }),
    [client, selected?.id, selected?.serviceId],
  );
  const moveSave = (
    input: Parameters<ReservationsAdminClient["reschedule"]>[1],
    slot: ReservationSlot,
  ) => {
    const id = selected?.id ?? "";
    return optimistic.run(
      (rows) =>
        rows?.map((row) =>
          row.id === id
            ? {
                ...row,
                ...previewReservationMove(
                  row,
                  input,
                  slot,
                  timeZone,
                  config.value?.resources.find((resource) => resource.id === input.resourceId)
                    ?.name ?? labels.anyResource,
                ),
              }
            : row,
        ),
      async () => {
        const saved = await client.reschedule(id, input);
        data.setValue((rows) => rows.map((row) => (row.id === id ? { ...row, ...saved } : row)));
        return saved;
      },
    );
  };
  return (
    <section className={cn(pageClass, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{labels.calendar}</h1>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} onClick={refresh}>
            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.refresh}
          </button>
          {settingsHref && (
            <HostLink className={buttonClass} href={settingsHref}>
              <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.settings}
            </HostLink>
          )}
          {canManage && (
            <button
              className={primaryClass}
              disabled={!config.value?.services.some((s) => s.active && !s.archived)}
              onClick={() => setDialog("new")}
            >
              <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.newBooking}
            </button>
          )}
        </div>
      </div>
      <ErrorNotice error={config.error ?? data.error ?? action.error} labels={labels} />
      {config.value && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={labels.resource}>
              <NativeSelect
                className={fieldClass}
                value={range.resourceId ?? ""}
                onChange={(e) => setRange({ ...range, resourceId: e.target.value || undefined })}
              >
                <option value="">{labels.all}</option>
                {config.value.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={labels.service}>
              <NativeSelect
                className={fieldClass}
                value={range.serviceId ?? ""}
                onChange={(e) => setRange({ ...range, serviceId: e.target.value || undefined })}
              >
                <option value="">{labels.all}</option>
                {config.value.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={labels.status}>
              <NativeSelect
                className={fieldClass}
                value={range.status ?? ""}
                onChange={(e) =>
                  setRange({
                    ...range,
                    status: e.target.value ? (e.target.value as ReservationStatus) : undefined,
                  })
                }
              >
                <option value="">{labels.all}</option>
                {(["pending", "confirmed", "rejected", "cancelled"] as const).map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">
            {labels.timeZone}: {config.value.settings.timeZone}
          </p>
        </>
      )}
      {(!data.value || !config.value) && !data.error && !config.error && (
        <output className="block">{labels.loading}</output>
      )}
      {mounted && config.value && (
        <div className="reservations-calendar min-w-0 overflow-x-auto rounded-xl border border-border p-3">
          <FullCalendar
            controller={calendar}
            plugins={[classicTheme, dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={mobile ? "listWeek" : "timeGridWeek"}
            initialDate={initialDate}
            locale={locale}
            timeZone={config.value.settings.timeZone}
            headerToolbar={{
              start: "previousPeriod,nextPeriod today",
              center: "title",
              end: "reservationsYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            toolbarElements={{
              previousPeriod: () => (
                <IconTooltip label={labels.previous}>
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={labels.previous}
                    disabled={calendar.getButtonState().prev?.isDisabled}
                    onClick={() => calendar.prev()}
                  >
                    <ChevronLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </IconTooltip>
              ),
              nextPeriod: () => (
                <IconTooltip label={labels.next}>
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={labels.next}
                    disabled={calendar.getButtonState().next?.isDisabled}
                    onClick={() => calendar.next()}
                  >
                    <ChevronRightIcon className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </IconTooltip>
              ),
            }}
            views={{
              reservationsYear: {
                duration: { months: 12 },
                dateAlignment: "month",
                dateIncrement: { years: 1 },
                titleFormat: { month: "short", year: "numeric" },
                content: (info) =>
                  data.value ? (
                    <ReservationYearView
                      key={info.view.currentStart.toISOString()}
                      start={localDate(info.view.currentStart.toISOString(), timeZone)}
                      reservations={bookings ?? []}
                      timeZone={timeZone}
                      locale={locale}
                      labels={labels}
                      onSelectDate={(date) => info.view.calendar.changeView("timeGridDay", date)}
                    />
                  ) : null,
              },
            }}
            toolbarClass="flex flex-wrap items-center justify-between gap-3 mb-4"
            toolbarSectionClass="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            buttonGroupClass="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            toolbarTitleClass="max-w-full text-lg font-semibold whitespace-normal"
            viewHint={(text) => text}
            buttons={{
              reservationsYear: { text: labels.year, hint: labels.year },
              dayGridMonth: { text: labels.month, hint: labels.month },
              timeGridWeek: { text: labels.week, hint: labels.week },
              timeGridDay: { text: labels.day, hint: labels.day },
              listWeek: { text: labels.agenda, hint: labels.agenda },
            }}
            buttonClass={cn(
              buttonClass,
              "aria-selected:bg-primary aria-selected:text-primary-foreground",
            )}
            todayText={labels.today}
            monthText={labels.month}
            weekTextLong={labels.week}
            dayText={labels.day}
            listText={labels.agenda}
            prevHint={labels.previous}
            nextHint={labels.next}
            todayHint={labels.today}
            height={mobile || view === "reservationsYear" ? "auto" : 640}
            firstDay={1}
            allDaySlot={false}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime="08:00:00"
            editable={false}
            eventInteractive
            noEventsText={labels.emptyCalendar}
            datesSet={datesSet}
            eventClass={(info) =>
              cn(
                `reservation-${String(info.event.extendedProps.status)}`,
                "rounded-md border px-1 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                info.event.extendedProps.status === "pending"
                  ? "bg-status-pending text-status-pending-foreground"
                  : info.event.extendedProps.status === "confirmed"
                    ? "bg-status-success text-status-success-foreground"
                    : "bg-status-canceled text-status-canceled-foreground",
              )
            }
            listItemEventTitleClass="whitespace-normal break-words p-2"
            listDayHeaderInnerClass="flex flex-wrap items-center justify-between gap-1 p-2 text-sm"
            events={(bookings ?? []).map((r) => ({
              id: r.id,
              start: r.startsAt,
              end: r.endsAt,
              title: `${r.customer.name} · ${r.serviceName} · ${r.resourceName} · ${labels[r.status]}${r.outsideHours ? ` · ${labels.outsideHours}` : ""}`,
              extendedProps: { status: r.status },
            }))}
            eventClick={(info) => setSelected(bookings?.find((r) => r.id === info.event.id))}
          />
        </div>
      )}
      {dialog === "new" && config.value && (
        <Modal
          title={labels.newBooking}
          description={labels.timeZone + ": " + config.value.settings.timeZone}
          onClose={() => setDialog(undefined)}
        >
          <BookingForm
            staff
            client={staffClient}
            catalog={catalog(config.value)}
            locale={locale}
            labels={labels}
            initialDate={initialDate}
            onBooked={refresh}
          />
        </Modal>
      )}
      {selected && !dialog && (
        <Modal
          title={selected.customer.name}
          description={
            selected.customer.email +
            (selected.customer.phone ? ` · ${selected.customer.phone}` : "")
          }
          onClose={() => setSelected(undefined)}
          busy={action.busy}
        >
          <ReservationSummary reservation={selected} locale={locale} labels={labels} />
          <ErrorNotice error={action.error} labels={labels} />
          {selected.outsideHours && (
            <output className="block text-sm text-destructive">{labels.outsideHours}</output>
          )}
          {selected.emailFailed && (
            <output className="block text-sm text-destructive">{labels.emailFailed}</output>
          )}
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <>
                {selected.status === "pending" && (
                  <>
                    <button
                      className={primaryClass}
                      disabled={action.busy || optimistic.pending}
                      onClick={() => {
                        void action.run(async () => {
                          await setStatus(selected.id, selected.version, "confirmed");
                          refresh();
                        });
                      }}
                    >
                      {labels.approve}
                    </button>
                    <button
                      className={buttonClass}
                      disabled={action.busy || optimistic.pending}
                      onClick={() => setDialog("rejected")}
                    >
                      {labels.reject}
                    </button>
                  </>
                )}
                {(selected.status === "pending" || selected.status === "confirmed") && (
                  <>
                    <button
                      className={buttonClass}
                      disabled={action.busy || optimistic.pending}
                      onClick={() => setDialog("move")}
                    >
                      {labels.reschedule}
                    </button>
                    <button
                      className={buttonClass}
                      disabled={action.busy || optimistic.pending}
                      onClick={() => setDialog("cancelled")}
                    >
                      {labels.cancel}
                    </button>
                  </>
                )}
                {selected.emailFailed && (
                  <button
                    className={buttonClass}
                    disabled={action.busy || optimistic.pending}
                    onClick={() => {
                      void action.run(async () => {
                        await client.retryEmail(selected.id);
                        refresh();
                      });
                    }}
                  >
                    {labels.retryEmail}
                  </button>
                )}
                <button
                  className={buttonClass}
                  disabled={action.busy || optimistic.pending}
                  onClick={() => setDialog("link")}
                >
                  {labels.revokeLink}
                </button>
              </>
            )}
            <button
              className={buttonClass}
              disabled={action.busy || optimistic.pending}
              onClick={() => setSelected(undefined)}
            >
              {labels.close}
            </button>
          </div>
        </Modal>
      )}
      {selected && (dialog === "cancelled" || dialog === "rejected" || dialog === "link") && (
        <Modal
          title={
            dialog === "link"
              ? labels.revokeLink
              : dialog === "cancelled"
                ? labels.cancel
                : labels.reject
          }
          description={
            dialog === "link"
              ? labels.revokeConfirm
              : dialog === "cancelled"
                ? labels.cancelConfirm
                : labels.rejectConfirm
          }
          onClose={() => setDialog(undefined)}
          busy={action.busy}
        >
          <ErrorNotice error={action.error} labels={labels} />
          <div className="flex gap-2">
            <button
              className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
              disabled={action.busy || optimistic.pending}
              onClick={() => setDialog(undefined)}
            >
              {labels.back}
            </button>
            <button
              className={primaryClass}
              disabled={action.busy || optimistic.pending}
              onClick={() => {
                void action.run(async () => {
                  if (dialog === "link") await client.revokeLink(selected.id, selected.version);
                  else {
                    const status = dialog;
                    setDialog(undefined);
                    await setStatus(selected.id, selected.version, status);
                  }
                  refresh();
                });
              }}
            >
              {dialog === "link"
                ? labels.revokeLink
                : dialog === "cancelled"
                  ? labels.cancel
                  : labels.reject}
            </button>
          </div>
        </Modal>
      )}
      {selected && dialog === "move" && (
        <RescheduleDialog
          reservation={selected}
          timeZone={config.value?.settings.timeZone ?? selected.timeZone}
          resources={
            config.value?.resources.filter(
              (r) =>
                r.active &&
                !r.archived &&
                config.value?.services
                  .find((s) => s.id === selected.serviceId)
                  ?.resourceIds.includes(r.id),
            ) ?? []
          }
          locale={locale}
          labels={labels}
          availability={moveAvailability}
          onSave={moveSave}
          onSaved={refresh}
          onClose={() => setDialog(undefined)}
        />
      )}
    </section>
  );
}
