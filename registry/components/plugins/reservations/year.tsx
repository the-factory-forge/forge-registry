"use client";

import { useMemo, useState } from "react";
import { Temporal } from "temporal-polyfill";

import type { ReservationLabels } from "@/components/plugins/reservations/labels";
import { localDate } from "@/components/plugins/reservations/model";
import type { ReservationAdminRecord } from "@/components/plugins/reservations/types";
import { cn } from "@/components/utils/cn";
import { tableClass, tableHeaderClass } from "@/components/utils/table-styles";

export interface ReservationYearViewProps {
  start: string;
  reservations: ReservationAdminRecord[];
  locale: string;
  timeZone: string;
  labels: ReservationLabels;
  onSelectDate: (date: string) => void;
}

export function ReservationYearView({
  start,
  reservations,
  locale,
  timeZone,
  labels,
  onSelectDate,
}: ReservationYearViewProps) {
  const firstMonth = Temporal.PlainDate.from(start).with({ day: 1 });
  const today = localDate(new Date().toISOString(), timeZone);
  const [focused, setFocused] = useState(() =>
    today >= start && today < firstMonth.add({ years: 1 }).toString() ? today : start,
  );
  const counts = useMemo(() => {
    const days = new Map<string, number>();
    for (const reservation of reservations) {
      let date = Temporal.PlainDate.from(localDate(reservation.startsAt, timeZone));
      const last =
        reservation.mode === "stay"
          ? localDate(new Date(Date.parse(reservation.endsAt) - 1).toISOString(), timeZone)
          : date.toString();
      while (date.toString() <= last) {
        const key = date.toString();
        days.set(key, (days.get(key) ?? 0) + 1);
        date = date.add({ days: 1 });
      }
    }
    return days;
  }, [reservations, timeZone]);
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
  const numberFormat = new Intl.NumberFormat(locale);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{labels.yearHelp}</p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border">
        <table className={cn(tableClass, "min-w-[88rem] table-fixed")}>
          <caption className="sr-only">{labels.year}</caption>
          <colgroup>
            <col className="w-40" />
            {Array.from({ length: 31 }, (_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <tbody>
            {Array.from({ length: 12 }, (_, index) => {
              const month = firstMonth.add({ months: index });
              return (
                <tr key={month.toString()}>
                  <th
                    scope="row"
                    className={cn(
                      tableHeaderClass,
                      "sticky left-0 z-10 border-r border-b border-border bg-background py-2",
                    )}
                  >
                    {monthFormat.format(new Date(`${month.toString()}T12:00:00Z`))}
                  </th>
                  {Array.from({ length: 31 }, (_, i) => {
                    if (i >= month.daysInMonth)
                      return (
                        <td
                          key={i}
                          aria-hidden="true"
                          className="border-r border-b border-border bg-muted"
                        />
                      );
                    const day = month.with({ day: i + 1 });
                    const date = day.toString();
                    const count = counts.get(date) ?? 0;
                    return (
                      <td key={i} className="border-r border-b border-border p-0">
                        <button
                          type="button"
                          data-date={date}
                          tabIndex={focused === date ? 0 : -1}
                          aria-current={today === date ? "date" : undefined}
                          aria-label={`${dateFormat.format(new Date(`${date}T12:00:00Z`))} · ${labels.calendar}: ${numberFormat.format(count)}`}
                          className={cn(
                            "flex min-h-10 w-full cursor-pointer scroll-mr-1 scroll-ml-40 flex-col items-center justify-center gap-0.5 px-1 py-1 hover:bg-accent focus-visible:relative focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
                            day.dayOfWeek > 5 && "bg-muted/50 text-muted-foreground",
                            count > 0 && "bg-accent text-accent-foreground",
                            today === date && "ring-2 ring-primary ring-inset",
                          )}
                          onFocus={(event) => {
                            setFocused(date);
                            event.currentTarget.scrollIntoView({
                              block: "nearest",
                              inline: "nearest",
                            });
                          }}
                          onClick={() => onSelectDate(date)}
                          onKeyDown={(event) => {
                            const next =
                              event.key === "ArrowRight"
                                ? day.add({ days: 1 })
                                : event.key === "ArrowLeft"
                                  ? day.subtract({ days: 1 })
                                  : event.key === "ArrowDown"
                                    ? day.add({ months: 1 })
                                    : event.key === "ArrowUp"
                                      ? day.subtract({ months: 1 })
                                      : event.key === "Home"
                                        ? day.with({ day: 1 })
                                        : event.key === "End"
                                          ? day.with({ day: day.daysInMonth })
                                          : null;
                            if (next) {
                              event.preventDefault();
                              event.currentTarget
                                .closest("table")
                                ?.querySelector<HTMLButtonElement>(
                                  `button[data-date="${next.toString()}"]`,
                                )
                                ?.focus();
                            }
                          }}
                        >
                          <span className="leading-4">{String(day.day).padStart(2, "0")}</span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "min-h-3 min-w-4 rounded-full px-1 text-[10px] leading-3",
                              count > 0 && "bg-primary font-semibold text-primary-foreground",
                            )}
                          >
                            {count > 0 ? numberFormat.format(count) : ""}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
