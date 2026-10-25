"use client";

import FullCalendar, { useCalendarController, type DatesSetInfo } from "@fullcalendar/react";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import { Temporal } from "temporal-polyfill";

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
  reservationDayCounts,
} from "@/components/plugins/reservations/model";
import { BookingForm, RescheduleDialog } from "@/components/plugins/reservations/public";
import type {
  Reservation,
  ReservationAdminRecord,
  ReservationCalendarState,
  ReservationCalendarView,
  ReservationFilters,
  ReservationRange,
  ReservationSlot,
  ReservationStatus,
  ReservationsAdminClient,
  ReservationsPublicClient,
} from "@/components/plugins/reservations/types";
import {
  buttonClass,
  iconButtonClass,
  primaryClass,
  fieldClass,
  pageClass,
  Field,
  DatePicker,
  Status,
  formatDateTime,
  ErrorNotice,
  Modal,
  ReservationSummary,
  useReservationAction,
  useReservationLoad,
} from "@/components/plugins/reservations/ui";
import { ReservationYearView } from "@/components/plugins/reservations/year";
import { TablePagination } from "@/components/table-pagination";
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
  calendarState?: ReservationCalendarState;
  onCalendarStateChange?: (state: ReservationCalendarState) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  filters?: ReservationFilters;
  onFiltersChange?: (filters: ReservationFilters) => void;
  newHref: string;
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
  calendarState,
  onCalendarStateChange,
  page: controlledPage,
  onPageChange,
  filters: controlledFilters,
  onFiltersChange,
  newHref,
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
  const [view, setView] = useState(calendarState?.view ?? "listWeek");
  const listView = (calendarState?.view ?? view) === "listWeek";
  const [localPage, setLocalPage] = useState(1);
  const page = controlledPage ?? localPage;
  function changePage(next: number) {
    setLocalPage(next);
    onPageChange?.(next);
  }
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [localFilters, setLocalFilters] = useState<ReservationFilters>({});
  const filters = controlledFilters ?? localFilters;
  const { resourceId, serviceId, status } = filters;
  function changeFilters(next: ReservationFilters) {
    setLocalPage(1);
    setLocalFilters(next);
    onFiltersChange?.(next);
  }
  const [range, setRange] = useState<ReservationRange>(() => {
    const from = initialDate ? new Date(`${initialDate}T00:00:00Z`) : new Date();
    return { from: from.toISOString(), to: new Date(from.getTime() + 7 * 86400000).toISOString() };
  });
  const [selectedRecord, setSelected] = useState<ReservationAdminRecord>();
  const [dialog, setDialog] = useState<"move" | "cancelled" | "rejected" | "link">();
  const load = useCallback(() => client.configuration(), [client]);
  const config = useReservationLoad(load);
  const labels = getReservationLabels(overrides, config.value?.mode);
  const timeZone = config.value?.settings.timeZone ?? "UTC";
  const loadBookings = useCallback(async () => {
    if (listView) return client.listPage({ page, resourceId, serviceId, status });
    return {
      items: await loadReservationCalendar(client, { ...range, resourceId, serviceId, status }),
      hasMore: false,
    };
  }, [client, listView, page, range, resourceId, serviceId, status]);
  const data = useReservationLoad(loadBookings);
  const reloadItems = useCallback(async () => (await loadBookings()).items, [loadBookings]);
  const displayed = data.value ?? (listView ? data.previousValue : undefined);
  const optimistic = useOptimisticAction(displayed?.items, reloadItems);
  const bookings = optimistic.value;
  const selected = bookings?.find((row) => row.id === selectedRecord?.id) ?? selectedRecord;
  async function setStatus(id: string, version: number, status: ReservationStatus) {
    await optimistic.run(
      (rows) => rows?.map((row) => (row.id === id ? { ...row, status } : row)),
      async () => {
        const saved = await client.setStatus(id, version, status);
        data.setValue((result) => ({
          ...result,
          items: result.items.map((row) => (row.id === id ? { ...row, ...saved } : row)),
        }));
      },
    );
  }
  const action = useReservationAction();
  const refresh = () => {
    data.reload();
    setSelected(undefined);
    setDialog(undefined);
  };
  const datesSet = (info: DatesSetInfo) => {
    const nextView = info.view.type as ReservationCalendarView;
    const date = localDate(info.view.calendar.getDate().toISOString(), timeZone);
    setView(nextView);
    setSelectedDate(date);
    if (calendarState && (calendarState.view !== nextView || calendarState.date !== date)) {
      onCalendarStateChange?.({ view: nextView, date });
    } else if (!calendarState) onCalendarStateChange?.({ view: nextView, date });
    if (nextView === "listWeek") return;
    setRange((r) => {
      const start = Temporal.PlainDate.from(
        localDate(info.view.currentStart.toISOString(), timeZone),
      );
      const gridStart = start.subtract({ days: start.dayOfWeek - 1 });
      const from =
        nextView === "reservationsMonth"
          ? gridStart.toZonedDateTime(timeZone).toInstant().toString()
          : info.start.toISOString();
      const to =
        nextView === "reservationsMonth"
          ? gridStart.add({ days: 42 }).toZonedDateTime(timeZone).toInstant().toString()
          : info.end.toISOString();
      return r.from === from && r.to === to ? r : { ...r, from, to };
    });
  };
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
        data.setValue((result) => ({
          ...result,
          items: result.items.map((row) => (row.id === id ? { ...row, ...saved } : row)),
        }));
        return saved;
      },
    );
  };
  return (
    <section className={cn(pageClass, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{labels.calendar}</h1>
        <div className="flex flex-wrap gap-2">
          <IconTooltip label={labels.refresh}>
            <button
              type="button"
              aria-label={labels.refresh}
              className={iconButtonClass}
              onClick={refresh}
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </IconTooltip>
          {settingsHref && (
            <HostLink className={buttonClass} href={settingsHref}>
              <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.settings}
            </HostLink>
          )}
          {canManage &&
            (config.value?.services.some((s) => s.active && !s.archived) ? (
              <HostLink className={primaryClass} href={newHref}>
                <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.newBooking}
              </HostLink>
            ) : (
              <button type="button" className={primaryClass} disabled>
                <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.newBooking}
              </button>
            ))}
        </div>
      </div>
      <ErrorNotice error={config.error ?? data.error ?? action.error} labels={labels} />
      {config.value && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={labels.resource}>
              <NativeSelect
                className={fieldClass}
                value={resourceId ?? ""}
                onChange={(e) =>
                  changeFilters({ ...filters, resourceId: e.target.value || undefined })
                }
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
                value={serviceId ?? ""}
                onChange={(e) =>
                  changeFilters({ ...filters, serviceId: e.target.value || undefined })
                }
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
                value={status ?? ""}
                onChange={(e) =>
                  changeFilters({
                    ...filters,
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
      {((!data.value && !listView) || !config.value) && !data.error && !config.error && (
        <output className="block">{labels.loading}</output>
      )}
      {mounted && config.value && (
        <div className="reservations-calendar min-w-0 overflow-x-auto rounded-xl border border-border p-3">
          <FullCalendar
            key={calendarState ? `${calendarState.view}/${calendarState.date}` : undefined}
            controller={calendar}
            plugins={[classicTheme, timeGridPlugin]}
            initialView={calendarState?.view ?? "listWeek"}
            initialDate={calendarState?.date ?? initialDate}
            locale={locale}
            timeZone={config.value.settings.timeZone}
            headerToolbar={{
              start: listView
                ? ""
                : view === "reservationsMonth"
                  ? "today"
                  : "previousPeriod,nextPeriod today",
              center: listView || view === "reservationsMonth" ? "" : "title",
              end: "reservationsYear,reservationsMonth,timeGridWeek,timeGridDay,listWeek",
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
              listWeek: { duration: { days: 1 }, content: () => null },
              reservationsMonth: {
                duration: { months: 1 },
                dateAlignment: "month",
                dateIncrement: { months: 1 },
                content: () => null,
              },
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
            viewClass={listView || view === "reservationsMonth" ? "hidden" : undefined}
            toolbarClass="flex flex-wrap items-center justify-between gap-3 mb-4"
            toolbarSectionClass="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            buttonGroupClass="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            toolbarTitleClass="max-w-full text-lg font-semibold whitespace-normal"
            viewHint={(text) => text}
            buttons={{
              reservationsYear: { text: labels.year, hint: labels.year },
              reservationsMonth: { text: labels.month, hint: labels.month },
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
            prevHint={labels.previous}
            nextHint={labels.next}
            todayHint={labels.today}
            height={
              mobile || listView || view === "reservationsYear" || view === "reservationsMonth"
                ? "auto"
                : 640
            }
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
            events={(bookings ?? []).map((r) => ({
              id: r.id,
              start: r.startsAt,
              end: r.endsAt,
              title: `${r.customer.name} · ${r.serviceName} · ${r.resourceName} · ${labels[r.status]}${r.outsideHours ? ` · ${labels.outsideHours}` : ""}`,
              extendedProps: { status: r.status },
            }))}
            eventClick={(info) => setSelected(bookings?.find((r) => r.id === info.event.id))}
          />
          {listView && (
            <section aria-label={labels.agenda} aria-busy={data.loading} className="space-y-3">
              <ReservationRows
                reservations={bookings}
                error={data.error}
                loading={data.loading || Boolean(data.error)}
                locale={locale}
                timeZone={timeZone}
                labels={labels}
                emptyLabel={labels.emptyList}
                onSelect={setSelected}
              />
              <TablePagination
                page={page}
                label={labels.pagination}
                previousLabel={labels.previousPage}
                nextLabel={labels.nextPage}
                previousDisabled={page <= 1}
                nextDisabled={!data.value?.hasMore}
                disabled={data.loading || optimistic.pending}
                onPrevious={() => changePage(page - 1)}
                onNext={() => changePage(page + 1)}
              />
            </section>
          )}
          {view === "reservationsMonth" && (
            <ReservationMonthView
              date={calendarState?.date ?? selectedDate ?? localDate(range.from, timeZone)}
              reservations={bookings}
              error={data.error}
              timeZone={timeZone}
              locale={locale}
              labels={labels}
              onDateChange={(date) => {
                setSelectedDate(date);
                if (calendarState) onCalendarStateChange?.({ view: "reservationsMonth", date });
                else calendar.gotoDate(date);
              }}
              onSelect={setSelected}
            />
          )}
        </div>
      )}
      {selected && !dialog && (
        <Modal
          closeLabel={labels.close}
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
          <div
            data-dialog-footer
            className="sticky bottom-0 z-10 -mx-6 flex flex-wrap gap-2 bg-popover px-6 pt-0 pb-5"
          >
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
          closeLabel={labels.close}
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
          <div
            data-dialog-footer
            className="sticky bottom-0 z-10 -mx-6 flex flex-wrap gap-2 bg-popover px-6 pt-0 pb-5"
          >
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

export interface ReservationNewPageProps {
  client: ReservationsAdminClient;
  backHref: string;
  onBooked: (reservation: Reservation) => void;
  locale?: string;
  labels?: Partial<ReservationLabels>;
  initialDate?: string;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}

export function ReservationNewPage({
  client,
  backHref,
  onBooked,
  locale = "en",
  labels: overrides,
  initialDate,
  className,
  linkComponent: HostLink = Link,
}: ReservationNewPageProps) {
  const load = useCallback(() => client.configuration(), [client]);
  const config = useReservationLoad(load);
  const labels = getReservationLabels(overrides, config.value?.mode);
  const staffClient = useMemo<ReservationsPublicClient>(
    () => ({
      catalog: async () => catalog(await client.configuration()),
      availability: (q) => client.availability(q),
      monthAvailability: client.monthAvailability?.bind(client),
      book: (input) => client.book(input),
    }),
    [client],
  );
  return (
    <section className={cn(pageClass, className)}>
      <HostLink className={buttonClass} href={backHref}>
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.back}
      </HostLink>
      <h1 className="font-serif text-3xl font-semibold">{labels.newBooking}</h1>
      <ErrorNotice error={config.error} labels={labels} />
      {config.error ? (
        <IconTooltip label={labels.refresh}>
          <button
            type="button"
            aria-label={labels.refresh}
            className={iconButtonClass}
            onClick={config.reload}
          >
            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </IconTooltip>
      ) : !config.value ? (
        <output className="block">{labels.loading}</output>
      ) : !catalog(config.value).services.length ? (
        <output className="block">{labels.emptyServices}</output>
      ) : (
        <BookingForm
          staff
          client={staffClient}
          catalog={catalog(config.value)}
          locale={locale}
          labels={labels}
          initialDate={initialDate}
          onBooked={onBooked}
        />
      )}
    </section>
  );
}

function ReservationMonthView({
  date,
  reservations,
  error,
  timeZone,
  locale,
  labels,
  onDateChange,
  onSelect,
}: {
  date: string;
  reservations?: ReservationAdminRecord[];
  error: unknown;
  timeZone: string;
  locale: string;
  labels: ReservationLabels;
  onDateChange: (date: string) => void;
  onSelect: (reservation: ReservationAdminRecord) => void;
}) {
  const counts = useMemo(
    () => reservationDayCounts(reservations ?? [], timeZone),
    [reservations, timeZone],
  );
  const rows = reservations?.filter((reservation) =>
    reservationDayCounts([reservation], timeZone).has(date),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <DatePicker
        date={date}
        month={Temporal.PlainDate.from(date).with({ day: 1 }).toString()}
        onChange={onDateChange}
        onMonthChange={onDateChange}
        counts={reservations ? counts : undefined}
        locale={locale}
        labels={labels}
        showInput={false}
      />
      <section className="min-w-0 space-y-3" aria-busy={!reservations && !error}>
        <h2 className="font-medium">
          {new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(
            new Date(`${date}T12:00:00Z`),
          )}
        </h2>
        <ReservationRows
          reservations={rows}
          error={error}
          locale={locale}
          timeZone={timeZone}
          labels={labels}
          emptyLabel={labels.emptyCalendar}
          onSelect={onSelect}
        />
      </section>
    </div>
  );
}

function ReservationRows({
  reservations,
  error,
  loading = false,
  locale,
  timeZone,
  labels,
  emptyLabel,
  onSelect,
}: {
  reservations?: ReservationAdminRecord[];
  error: unknown;
  loading?: boolean;
  locale: string;
  timeZone: string;
  labels: ReservationLabels;
  emptyLabel: string;
  onSelect: (reservation: ReservationAdminRecord) => void;
}) {
  return (
    <div className="min-h-40">
      {!reservations ? (
        <output>{error ? labels.error : labels.loading}</output>
      ) : !reservations.length ? (
        <output>{emptyLabel}</output>
      ) : (
        <ul className="divide-y divide-border">
          {reservations.map((reservation) => (
            <li key={reservation.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer flex-wrap items-start justify-between gap-2 rounded-lg px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring enabled:hover:bg-accent disabled:cursor-not-allowed"
                disabled={loading}
                onClick={() => onSelect(reservation)}
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-medium wrap-anywhere">
                    {reservation.customer.name} · {reservation.serviceName} ·{" "}
                    {reservation.resourceName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDateTime(reservation.startsAt, locale, timeZone)} –{" "}
                    {formatDateTime(reservation.endsAt, locale, timeZone)}
                  </span>
                  {reservation.outsideHours && (
                    <span className="block text-sm">{labels.outsideHours}</span>
                  )}
                </span>
                <Status status={reservation.status} labels={labels} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
