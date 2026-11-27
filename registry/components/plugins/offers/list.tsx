"use client";
import { PlusIcon, ArrowUpRightIcon } from "lucide-react";
import type { ComponentType } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import { NativeSelect } from "@/components/native-select";
import { StatusBadge } from "@/components/plugins/customers/ui";
import { offerLabels, type OfferLabels } from "@/components/plugins/offers/labels";
import {
  offerDefaultSort,
  offerSortFields,
  offerStatuses,
  formatOfferNumber,
  moneyFormatter,
  type OfferRow,
  type OfferStatus,
} from "@/components/plugins/offers/model";
import { TablePagination, type TablePaginationProps } from "@/components/table-pagination";
import { TableSearch } from "@/components/table-search";
import { TableSortHeader, useTableSort, type TableSortProps } from "@/components/table-sort";
import { primaryClass, iconButtonClass } from "@/components/utils/table-controls";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableCellClass,
  tableClass,
  tablePanelClass,
  tableRowClass,
  tableHeaderClass,
} from "@/components/utils/table-styles";
export function OfferBadge({ status, labels }: { status: OfferStatus; labels: OfferLabels }) {
  const tones = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-status-pending text-status-pending-foreground",
    accepted: "bg-status-success text-status-success-foreground",
    declined: "bg-status-canceled text-status-canceled-foreground",
  };
  return (
    <StatusBadge
      value={status}
      options={offerStatuses.map((value) => ({ value, label: labels[value] }))}
      label={labels.status}
      className={tones[status]}
      successMessage=""
      errorMessage=""
    />
  );
}
export interface OffersListProps extends TableSortProps<(typeof offerSortFields)[number]> {
  rows: readonly OfferRow[];
  search: string;
  onSearchChange: (v: string) => void;
  status?: OfferStatus;
  onStatusChange: (v: OfferStatus | undefined) => void;
  customerId?: string;
  createHref?: string;
  getOfferHref: (id: string) => string;
  getCustomerHref: (id: string) => string;
  locale: string;
  pagination: TablePaginationProps;
  loading?: boolean;
  error?: string;
  labels?: Partial<OfferLabels>;
  linkComponent?: ComponentType<LinkProps>;
}
export function OffersList(props: OffersListProps) {
  const { rows, customerId, locale, linkComponent: A = Link } = props;
  const l = { ...offerLabels, ...props.labels };
  useLoadingActivity(!!props.loading);
  const headers = useTableSort(props, offerDefaultSort, undefined, {
    key: customerId ? "customer-offers" : "offers",
    fields: offerSortFields,
  });
  const columns = [
    "number",
    "title",
    ...(customerId ? [] : ["customer"]),
    "date",
    "validUntil",
    "status",
    "net",
    "gross",
    "emailStatus",
  ] as const;
  const visible = customerId ? rows.filter((r) => r.customerId === customerId) : rows;
  return (
    <section className={tablePanelClass}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{l.offers}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={props.search} onValueChange={props.onSearchChange} label={l.search} />
          <div>
            <NativeSelect
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
              aria-label={l.status}
              value={props.status ?? ""}
              onChange={(e) =>
                props.onStatusChange(offerStatuses.find((s) => s === e.target.value))
              }
            >
              <option value="">{l.all}</option>
              {offerStatuses.map((s) => (
                <option key={s} value={s}>
                  {l[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {props.createHref && (
            <A href={props.createHref} className={primaryClass}>
              <PlusIcon />
              {l.create}
            </A>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass} aria-label={l.offers} aria-busy={!!props.loading}>
          <thead>
            <tr className={tableRowClass}>
              {columns.map((c) => {
                const field = offerSortFields.find((f) => f === c);
                return field ? (
                  <TableSortHeader
                    key={field}
                    {...headers}
                    field={field}
                    label={l[field]}
                    className={field === "net" || field === "gross" ? "text-right" : undefined}
                  />
                ) : (
                  <th key={c} scope="col" className={tableHeaderClass}>
                    {c === "customer" ? l.customer : l.emailStatus}
                  </th>
                );
              })}
              <th scope="col" className={tableActionHeaderClass}>
                {l.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const money = moneyFormatter(r.currency, locale).format;
              return (
                <tr key={r.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <A className="font-medium underline" href={props.getOfferHref(r.id)}>
                      {formatOfferNumber(r.number)}
                    </A>
                  </td>
                  <th scope="row" className={tableCellClass + " text-left font-medium"}>
                    {r.title}
                  </th>
                  {!customerId && (
                    <td className={tableCellClass}>
                      <A href={props.getCustomerHref(r.customerId)} className="underline">
                        {r.customer}
                      </A>
                    </td>
                  )}
                  <td className={tableCellClass}>{r.date}</td>
                  <td className={tableCellClass}>{r.validUntil}</td>
                  <td className={tableCellClass}>
                    <OfferBadge status={r.status} labels={l} />
                  </td>
                  {[r.net, r.gross].map((v, i) => (
                    <td
                      key={i}
                      className={tableCellClass + " text-right whitespace-nowrap tabular-nums"}
                    >
                      {money(v)}
                    </td>
                  ))}
                  <td className={tableCellClass}>{r.sent ? l.sent : l.unsent}</td>
                  <td className={tableActionCellClass}>
                    <IconTooltip label={r.title}>
                      <A
                        aria-label={r.title}
                        className={iconButtonClass}
                        href={props.getOfferHref(r.id)}
                      >
                        <ArrowUpRightIcon />
                      </A>
                    </IconTooltip>
                  </td>
                </tr>
              );
            })}
            {(!visible.length || props.error) && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-6 text-center"
                  role={props.error ? "alert" : "status"}
                >
                  {props.error ?? (props.loading ? l.loading : l.empty)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...props.pagination} />
    </section>
  );
}
