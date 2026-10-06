"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Temporal } from "temporal-polyfill";

import type { ReservationLabels } from "@/components/plugins/reservations/labels";
import {
  ReservationError,
  type Reservation,
  type ReservationSlot,
} from "@/components/plugins/reservations/types";
import { cn } from "@/components/utils/cn";

export const buttonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
export const primaryClass = cn(
  buttonClass,
  "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
);
export const fieldClass =
  "min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm";
export const panelClass = "rounded-2xl border border-border bg-card p-5 text-card-foreground";
export const pageClass = "mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-foreground";

export function message(error: unknown, labels: ReservationLabels) {
  const code =
    error instanceof ReservationError
      ? error.code
      : error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
  if (code === "MODE_MISMATCH") return labels.modeMismatch;
  if (code === "INVALID") return labels.invalid;
  if (code === "CONFLICT") return labels.conflict;
  if (code === "FORBIDDEN") return labels.forbidden;
  if (code === "CUTOFF") return labels.cutoff;
  if (code === "INVALID_LINK") return labels.invalidLink;
  if (code === "CLOSED") return labels.unavailable;
  return labels.error;
}

export function useReservationLoad<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    load: () => Promise<T>;
    revision: number;
    value?: T;
    error?: unknown;
  }>();
  useEffect(() => {
    let current = true;
    void load().then(
      (value) => {
        if (current) setResult({ load, revision, value });
      },
      (error: unknown) => {
        if (current) setResult({ load, revision, error });
      },
    );
    return () => {
      current = false;
    };
  }, [load, revision]);
  const current = result?.load === load && result.revision === revision ? result : undefined;
  return { value: current?.value, error: current?.error, reload: () => setRevision((v) => v + 1) };
}

export function useReservationAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function ErrorNotice({ error, labels }: { error: unknown; labels: ReservationLabels }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {message(error, labels)}
    </p>
  ) : null;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
          <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Status({
  status,
  labels,
}: {
  status: Reservation["status"];
  labels: ReservationLabels;
}) {
  const colors = {
    pending: "bg-status-pending text-status-pending-foreground",
    confirmed: "bg-status-success text-status-success-foreground",
    rejected: "bg-status-canceled text-status-canceled-foreground",
    cancelled: "bg-status-canceled text-status-canceled-foreground",
  };
  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", colors[status])}
    >
      {labels[status]}
    </span>
  );
}

export function formatTime(iso: string, locale: string, zone: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
    timeZone: zone,
  }).format(new Date(iso));
}
export function formatDateTime(iso: string, locale: string, zone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(iso));
}

export function ReservationSummary({
  reservation: r,
  labels,
  locale,
}: {
  reservation: Reservation;
  labels: ReservationLabels;
  locale: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-lg font-semibold wrap-anywhere">{r.serviceName}</h2>
        <div className="ml-auto max-w-full">
          <Status status={r.status} labels={labels} />
        </div>
      </div>
      <p>{r.resourceName}</p>
      <p>
        {r.mode === "stay" && `${labels.arrivalDate}: `}
        {formatDateTime(r.startsAt, locale, r.timeZone)} –{" "}
        {r.mode === "stay"
          ? `${labels.departureDate}: ${formatDateTime(r.endsAt, locale, r.timeZone)}`
          : formatTime(r.endsAt, locale, r.timeZone)}
      </p>
      <p className="text-sm text-muted-foreground">
        {r.timeZone} · {r.mode === "stay" ? labels.nights : labels.duration}:{" "}
        {r.mode === "stay" ? r.nights : r.policy.durationMinutes}
      </p>
      <p className="text-sm">
        {labels.cancellationDeadline}: {formatDateTime(r.cancellationDeadline, locale, r.timeZone)}
      </p>
      {r.status === "pending" && (
        <p className="text-sm text-muted-foreground">{labels.approvalRequired}</p>
      )}
    </div>
  );
}

export function DatePicker({
  date,
  onChange,
  locale,
  labels,
  minDate,
  range,
  showInput = true,
}: {
  date: string;
  onChange: (date: string) => void;
  locale: string;
  labels: ReservationLabels;
  minDate?: string;
  range?: { from: string; to: string };
  showInput?: boolean;
}) {
  const selected = Temporal.PlainDate.from(date);
  const [month, setMonth] = useState(() => selected.with({ day: 1 }).toString());
  const start = Temporal.PlainDate.from(month);
  const gridStart = start.subtract({ days: start.dayOfWeek - 1 });
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}T12:00:00Z`));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={buttonClass}
          aria-label={labels.previous}
          onClick={() => setMonth(start.subtract({ months: 1 }).toString())}
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </button>
        <span className="font-medium" aria-live="polite">
          {monthLabel}
        </span>
        <button
          type="button"
          className={buttonClass}
          aria-label={labels.next}
          onClick={() => setMonth(start.add({ months: 1 }).toString())}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="py-1 text-center text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
              new Date(`2026-09-${String(21 + i)}T12:00:00Z`),
            )}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = gridStart.add({ days: i });
          const value = day.toString();
          return (
            <button
              type="button"
              key={value}
              disabled={!!minDate && value < minDate}
              aria-pressed={range ? value >= range.from && value <= range.to : date === value}
              aria-label={new Intl.DateTimeFormat(locale, {
                dateStyle: "full",
                timeZone: "UTC",
              }).format(new Date(`${value}T12:00:00Z`))}
              className={cn(
                "min-h-10 cursor-pointer rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
                day.month !== start.month && "text-muted-foreground",
                date === value
                  ? "bg-primary text-primary-foreground"
                  : range && value >= range.from && value <= range.to
                    ? "bg-primary/15 text-foreground"
                    : "hover:bg-accent",
              )}
              onClick={() => onChange(value)}
            >
              {day.day}
            </button>
          );
        })}
      </div>
      {showInput && (
        <Field label={labels.date}>
          <input
            type="date"
            className={fieldClass}
            value={date}
            min={minDate}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                onChange(e.target.value);
                setMonth(Temporal.PlainDate.from(e.target.value).with({ day: 1 }).toString());
              }
            }}
          />
        </Field>
      )}
    </div>
  );
}

export function StayDatePicker({
  arrival,
  departure,
  onChange,
  minNights,
  labels,
  locale,
}: {
  arrival: string;
  departure: string;
  onChange: (arrival: string, departure: string) => void;
  minNights: number;
  labels: ReservationLabels;
  locale: string;
}) {
  const [endpoint, setEndpoint] = useState<"arrival" | "departure">("arrival");
  const departureInput = useRef<HTMLInputElement>(null);
  const choose = (value: string, part = endpoint) => {
    if (part === "arrival") {
      const minimum = Temporal.PlainDate.from(value).add({ days: minNights }).toString();
      onChange(value, departure < minimum ? minimum : departure);
      setEndpoint("departure");
    } else onChange(arrival, value);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["arrival", "departure"] as const).map((part) => (
          <Field key={part} label={part === "arrival" ? labels.arrivalDate : labels.departureDate}>
            <input
              type="date"
              required
              className={fieldClass}
              ref={part === "departure" ? departureInput : undefined}
              value={part === "arrival" ? arrival : departure}
              min={
                part === "departure"
                  ? Temporal.PlainDate.from(arrival).add({ days: minNights }).toString()
                  : undefined
              }
              onFocus={() => setEndpoint(part)}
              onChange={(event) => {
                if (event.target.value) choose(event.target.value, part);
              }}
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={endpoint === "arrival" ? primaryClass : buttonClass}
          aria-pressed={endpoint === "arrival"}
          onClick={() => setEndpoint("arrival")}
        >
          {labels.arrivalDate}
        </button>
        <button
          type="button"
          className={endpoint === "departure" ? primaryClass : buttonClass}
          aria-pressed={endpoint === "departure"}
          onClick={() => setEndpoint("departure")}
        >
          {labels.departureDate}
        </button>
      </div>
      <DatePicker
        key={endpoint + (endpoint === "arrival" ? arrival.slice(0, 7) : departure.slice(0, 7))}
        date={endpoint === "arrival" ? arrival : departure}
        onChange={(value) => {
          choose(value);
          if (endpoint === "arrival") departureInput.current?.focus();
        }}
        labels={labels}
        locale={locale}
        minDate={
          endpoint === "departure"
            ? Temporal.PlainDate.from(arrival).add({ days: minNights }).toString()
            : undefined
        }
        range={{ from: arrival, to: departure }}
        showInput={false}
      />
    </div>
  );
}

export function SlotPicker({
  slots,
  selected,
  onChange,
  locale,
  zone,
  labels,
}: {
  slots: ReservationSlot[];
  selected: string;
  onChange: (value: string) => void;
  locale: string;
  zone: string;
  labels: ReservationLabels;
}) {
  return slots.length ? (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">{labels.time}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => (
          <button
            key={slot.startsAt}
            type="button"
            className={selected === slot.startsAt ? primaryClass : buttonClass}
            aria-pressed={selected === slot.startsAt}
            onClick={() => onChange(slot.startsAt)}
          >
            {formatTime(slot.startsAt, locale, zone)}
          </button>
        ))}
      </div>
    </fieldset>
  ) : (
    <output className="block text-sm text-muted-foreground">{labels.emptySlots}</output>
  );
}
