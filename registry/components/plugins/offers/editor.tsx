"use client";
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import { inputClass, Feedback, useCustomerAction } from "@/components/plugins/customers/ui";
import { customerDisplayName } from "@/components/plugins/customers/utils";
import { offerLabels, type OfferLabels } from "@/components/plugins/offers/labels";
import {
  editLine,
  readLine,
  useOfferLineOrder,
  type OfferLineControls,
} from "@/components/plugins/offers/line-draft";
import {
  emptyLine,
  emptyOffer,
  formatOfferNumber,
  lineAmounts,
  moneyFormatter,
  offerInputSchema,
  offerLineSchema,
  offerTotals,
  recipientAddressLines,
  type OfferInput,
  type OfferLine,
  type Offer,
  type OfferRecipient,
  type OfferSender,
} from "@/components/plugins/offers/model";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { cn } from "@/components/utils/cn";
import { destructiveActionClass } from "@/components/utils/destructive-action";
import {
  buttonClass,
  iconButtonClass,
  primaryClass,
  outlineButtonClass,
} from "@/components/utils/table-controls";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";

const lineInputClass = cn(inputClass, "rounded-md px-2 md:h-8");
export function Recipient({ customer }: { customer: OfferRecipient }) {
  return (
    <address className="text-sm leading-relaxed not-italic">
      {recipientAddressLines(customer).map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </address>
  );
}
export function OfferAddresses({
  sender,
  recipient,
  customerHref,
  labels,
  customerPicker,
  linkComponent: A = Link,
}: {
  sender?: OfferSender;
  recipient?: OfferRecipient;
  customerHref?: string;
  labels: OfferLabels;
  customerPicker?: ReactNode;
  linkComponent?: ComponentType<LinkProps>;
}) {
  return (
    <div className="@container/addresses space-y-4">
      {sender && (
        <div className="@min-[32rem]/addresses:w-1/2">
          <h2 className="mb-1 text-sm text-muted-foreground">{labels.sender}</h2>
          <address className="text-sm leading-relaxed wrap-anywhere not-italic">
            <strong>{sender.issuer}</strong>
            {sender.issuerAddress && (
              <div className="whitespace-pre-line">{sender.issuerAddress}</div>
            )}
          </address>
        </div>
      )}
      <div
        className={
          sender ? "@min-[32rem]/addresses:ml-auto @min-[32rem]/addresses:w-1/2" : undefined
        }
      >
        {customerPicker ?? <h2 className="text-sm text-muted-foreground">{labels.recipient}</h2>}
        {recipient && (
          <div className="mt-1 wrap-anywhere">
            <Recipient customer={recipient} />
            {customerHref && (
              <A className="text-sm underline" href={customerHref}>
                {labels.editCustomer}
              </A>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function OfferTotals({
  lines,
  currency,
  locale,
  labels: l,
}: {
  lines: OfferLine[];
  currency: string;
  locale: string;
  labels: OfferLabels;
}) {
  const amounts = offerTotals(lines);
  const money = moneyFormatter(currency, locale).format;
  return (
    <dl
      aria-label={l.totals}
      className="ml-auto grid w-fit grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm tabular-nums"
    >
      <dt>{l.net}</dt>
      <dd className="text-right">{money(amounts.net)}</dd>
      {amounts.taxes.map((t) => (
        <div key={t.rate} className="contents">
          <dt>
            {l.taxAmount} {t.rate / 100}%
          </dt>
          <dd className="text-right">{money(t.amount)}</dd>
        </div>
      ))}
      <dt className="font-bold">{l.gross}</dt>
      <dd className="text-right font-bold">{money(amounts.gross)}</dd>
    </dl>
  );
}
export const offerNumericColumnClass = "text-end whitespace-nowrap tabular-nums";

export const offerEditorLabels = {
  cancel: "Cancel",
  close: "Close",
  deleteOffer: "Delete offer",
  confirmDelete: "Delete",
  deleteDescription: (number: string) => `Delete offer ${number}? This action cannot be undone.`,
  deleted: "Offer deleted.",
  deleting: "Deleting…",
  reorderLine: "Reorder line",
};

export function OfferLinePosition({
  position,
  labels,
  controls,
}: {
  position: number;
  labels: Pick<OfferLabels, "up" | "down"> & Pick<typeof offerEditorLabels, "reorderLine">;
  controls?: OfferLineControls;
}) {
  return (
    <th
      scope="row"
      aria-label={String(position)}
      className={cn(tableCellClass, "py-0 text-start font-normal tabular-nums")}
    >
      {controls ? (
        <div className="flex items-center print:contents">
          <IconTooltip label={labels.reorderLine}>
            <button
              type="button"
              aria-label={labels.reorderLine + " " + position}
              aria-keyshortcuts="ArrowUp ArrowDown"
              className={cn(
                buttonClass,
                "-ms-1.5 touch-none px-1.5 font-normal select-none enabled:cursor-grab enabled:active:cursor-grabbing disabled:opacity-100 print:contents",
              )}
              disabled={!controls.moveUp && !controls.moveDown}
              {...controls.handle}
            >
              <span>{position}</span>
            </button>
          </IconTooltip>
          <div className="flex group-hover/offer-line:pointer-events-auto group-hover/offer-line:opacity-100 has-[:focus-visible]:opacity-100 print:hidden [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0">
            {[
              { label: labels.up, Icon: ArrowUpIcon, move: controls.moveUp },
              { label: labels.down, Icon: ArrowDownIcon, move: controls.moveDown },
            ].map(({ label, Icon, move }) => (
              <IconTooltip key={label} label={label}>
                <button
                  type="button"
                  aria-label={label}
                  className={cn(buttonClass, "size-10 shrink-0 p-0 md:size-7 md:min-h-7")}
                  disabled={!move}
                  onClick={move}
                >
                  <Icon aria-hidden="true" />
                </button>
              </IconTooltip>
            ))}
          </div>
        </div>
      ) : (
        position
      )}
    </th>
  );
}

export function OfferLineTable({
  labels: l,
  children,
  totals,
  money,
  lineActions = false,
  inlineEditing = false,
  onAddLine,
  addLineDisabled,
}: {
  labels: OfferLabels;
  children: ReactNode;
  totals?: ReturnType<typeof offerTotals>;
  money: (amount: number) => string;
  lineActions?: boolean;
  inlineEditing?: boolean;
  onAddLine?: () => void;
  addLineDisabled?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          tableClass,
          inlineEditing &&
            "not-print:min-w-[42rem] not-print:table-fixed not-print:wrap-anywhere not-print:[&_td]:whitespace-normal",
        )}
        aria-label={l.lines}
      >
        <thead>
          <tr className={tableRowClass}>
            <th
              scope="col"
              className={cn(tableHeaderClass, inlineEditing && "not-print:w-32 md:not-print:w-28")}
            >
              {l.position ?? offerLabels.position}
            </th>
            <th scope="col" className={tableHeaderClass}>
              {l.description}
            </th>
            {[
              [l.quantity, "not-print:w-[13%]"],
              [l.price, "not-print:w-[14%]"],
              [l.discount, "not-print:w-[12%]"],
              [l.tax, "not-print:w-[9%]"],
              [l.net, "not-print:w-[14%]"],
            ].map(([label, width], index) => (
              <th
                scope="col"
                key={index}
                className={cn(
                  tableHeaderClass,
                  offerNumericColumnClass,
                  inlineEditing && "not-print:whitespace-normal",
                  inlineEditing && width,
                )}
              >
                {label}
              </th>
            ))}
            {lineActions && (
              <th
                scope="col"
                className={cn(
                  tableActionHeaderClass,
                  onAddLine && "py-0 print:hidden",
                  inlineEditing && "not-print:w-12",
                )}
              >
                <span className="sr-only">{l.actions}</span>
                {onAddLine && (
                  <IconTooltip label={l.add}>
                    <button
                      type="button"
                      aria-label={l.add}
                      className={iconButtonClass}
                      disabled={addLineDisabled}
                      onClick={onAddLine}
                    >
                      <PlusIcon aria-hidden="true" />
                    </button>
                  </IconTooltip>
                )}
              </th>
            )}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {totals && (
          <tfoot>
            {[
              [l.net, totals.net] as const,
              ...totals.taxes.map(
                ({ rate, amount }) => [l.taxAmount + " " + rate / 100 + "%", amount] as const,
              ),
              [l.gross, totals.gross] as const,
            ].map(([label, amount]) => (
              <tr
                key={label}
                className="first:font-bold last:font-bold last:[&>*]:border-y last:[&>*]:border-border"
              >
                <td aria-hidden="true" />
                <th
                  scope="row"
                  colSpan={5}
                  className={cn(tableCellClass, "py-1 text-start [font-weight:inherit]")}
                >
                  {label}
                </th>
                <td
                  className={cn(
                    tableCellClass,
                    offerNumericColumnClass,
                    "sticky end-0 bg-card py-1",
                  )}
                >
                  {money(amount)}
                </td>
                {lineActions && <td aria-hidden="true" />}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

export interface OfferEditorProps {
  offer?: Offer;
  sender?: OfferSender;
  customerId?: string;
  customers: readonly OfferRecipient[];
  today: string;
  currency: string;
  locale: string;
  backHref: string;
  getCustomerHref: (id: string) => string;
  onSave: (customerId: string, values: OfferInput, version?: number) => Promise<void>;
  onDelete?: (id: string, version: number) => Promise<void>;
  renderProductPicker?: (add: (line: OfferLine) => void) => ReactNode;
  labels?: Partial<OfferLabels & typeof offerEditorLabels>;
  linkComponent?: ComponentType<LinkProps>;
}
export function OfferEditor({
  offer,
  sender,
  customerId,
  customers,
  currency,
  locale,
  today,
  backHref,
  getCustomerHref,
  onSave,
  onDelete,
  renderProductPicker,
  labels,
  linkComponent: A = Link,
}: OfferEditorProps) {
  const l = { ...offerLabels, ...offerEditorLabels, ...labels };
  const { digits, format: money } = moneyFormatter(offer?.currency ?? currency, locale);
  const [base] = useState(() => ({
    version: offer?.version,
    values: offer?.draft ?? offer?.issued?.content ?? emptyOffer(today),
  }));
  const [values, setValues] = useState(base.values);
  const [lines, setLines] = useState(() =>
    base.values.lines.map((line) => editLine(line, digits, crypto.randomUUID())),
  );
  const [owner, setOwner] = useState(offer?.customerId ?? customerId ?? "");
  const customer = customers.find((c) => c.id === owner);
  const [invalid, setInvalid] = useState(false);
  const action = useCustomerAction(l.failed, offer?.id ?? customerId);
  const formRef = useRef<HTMLFormElement>(null);
  const version = base.version;
  const deletion = useRecordDeletion({
    items: offer ? [offer] : [],
    scope: offer?.id,
    getName: (item) => formatOfferNumber(item.number),
    onDelete: onDelete && version !== undefined ? (id) => onDelete(id, version) : undefined,
    label: l.deleteOffer,
    labels: { ...l, actionError: l.failed, pending: l.deleting },
    disabled: action.pending,
    returnFocus: formRef,
  });
  const pending = action.pending || deletion.pending;
  const parsed = lines.map((line) => readLine(line, digits));
  const validAmounts = parsed.map(
    (line) => offerLineSchema.safeParse({ ...line, description: "—" }).success,
  );
  const fields = [
    { field: "priceMinor", label: l.price, step: 10 ** -digits, min: 0 },
    { field: "discountBps", label: l.discount, step: 0.01, min: 0, max: 100 },
    { field: "taxBps", label: l.tax, step: 0.01, min: 0, max: 100 },
  ] as const;
  function add(line: OfferLine) {
    const next = editLine(line, digits, crypto.randomUUID());
    setLines((old) => [...old, next]);
  }
  function change(key: string, field: string, value: string) {
    setLines((old) => old.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }
  const order = useOfferLineOrder(lines, setLines, pending);
  return (
    <div className="space-y-4">
      <BackLink href={backHref} linkComponent={A}>
        {l.back}
      </BackLink>
      <h1 className="text-2xl font-semibold">
        {offer ? l.editing + " " + formatOfferNumber(offer.number) : l.newOffer}
      </h1>
      <form
        ref={formRef}
        tabIndex={-1}
        className={tablePanelClass + " space-y-5"}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const input = offerInputSchema.safeParse({ ...values, lines: parsed });
          setInvalid(!input.success || !customer);
          if (input.success && customer)
            void action.run(() => onSave(customer.id, input.data, base.version), l.saved);
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <OfferAddresses
            sender={sender}
            recipient={customer}
            customerHref={customer && getCustomerHref(customer.id)}
            labels={l}
            linkComponent={A}
            customerPicker={
              <label className="block text-sm font-medium">
                {l.customer}
                <NativeSelect
                  className={inputClass}
                  value={owner}
                  required
                  disabled={!!(offer || customerId)}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="">{l.choose}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {customerDisplayName(c)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            }
          />
          <section className="grid gap-3 sm:grid-cols-2">
            {(["title", "date", "validUntil"] as const).map((f) => (
              <label
                key={f}
                className={
                  f === "title"
                    ? "block text-sm font-medium sm:col-span-2"
                    : "block text-sm font-medium"
                }
              >
                {l[f]}
                <input
                  required
                  className={inputClass}
                  type={f === "title" ? "text" : "date"}
                  maxLength={200}
                  min={f === "validUntil" ? values.date : undefined}
                  value={values[f]}
                  onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                />
              </label>
            ))}
          </section>
          <section className="space-y-3">
            <OfferLineTable
              labels={l}
              money={money}
              lineActions
              onAddLine={() => add(emptyLine())}
              addLineDisabled={lines.length >= 200}
              totals={validAmounts.every(Boolean) ? offerTotals(parsed) : undefined}
            >
              {lines.map((line, i) => (
                <tr
                  key={line.key}
                  className={cn(tableRowClass, "group/offer-line", order.rowClass(line.key))}
                >
                  <OfferLinePosition
                    position={i + 1}
                    labels={l}
                    controls={order.controls(line.key, i)}
                  />
                  <td className={cn(tableCellClass, "w-full")}>
                    <textarea
                      aria-label={l.description + " " + (i + 1)}
                      required
                      maxLength={2000}
                      rows={1}
                      className={cn(
                        lineInputClass,
                        "field-sizing-content min-h-10 min-w-40 py-1.5 md:h-auto md:min-h-8",
                      )}
                      value={line.description}
                      onChange={(e) => change(line.key, "description", e.target.value)}
                    />
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex justify-end gap-1">
                      <input
                        aria-label={l.quantity + " " + (i + 1)}
                        className={cn(lineInputClass, "w-24 min-w-24 text-end tabular-nums")}
                        type="number"
                        required
                        min={0.001}
                        step={0.001}
                        value={line.quantityMilli}
                        onChange={(e) => change(line.key, "quantityMilli", e.target.value)}
                      />
                      <input
                        aria-label={l.unit + " " + (i + 1)}
                        className={cn(lineInputClass, "w-24 min-w-24")}
                        type="text"
                        maxLength={40}
                        value={line.unit}
                        onChange={(e) => change(line.key, "unit", e.target.value)}
                      />
                    </div>
                  </td>
                  {fields.map(({ field, label, ...limits }) => (
                    <td key={field} className={tableCellClass}>
                      <input
                        {...limits}
                        aria-label={label + " " + (i + 1)}
                        className={cn(lineInputClass, "w-24 min-w-24 text-end tabular-nums")}
                        required
                        type="number"
                        value={line[field]}
                        onChange={(e) => change(line.key, field, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className={cn(tableCellClass, offerNumericColumnClass)}>
                    {validAmounts[i] ? money(lineAmounts(parsed[i]).net) : "—"}
                  </td>
                  <td className={tableActionCellClass}>
                    <IconTooltip label={l.remove}>
                      <button
                        type="button"
                        aria-label={l.remove}
                        className={cn(iconButtonClass, destructiveActionClass)}
                        onClick={() => setLines((old) => old.filter((r) => r.key !== line.key))}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </button>
                    </IconTooltip>
                  </td>
                </tr>
              ))}
            </OfferLineTable>
            {lines.length < 200 && renderProductPicker?.(add)}
          </section>
          {(["terms", "notes"] as const).map((f) => (
            <label key={f} className="block text-sm font-medium">
              {l[f]}
              <textarea
                className={inputClass + " h-auto py-2"}
                maxLength={5000}
                value={values[f]}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              />
            </label>
          ))}
        </fieldset>
        <Feedback feedback={invalid ? { error: true, message: l.invalid } : action.feedback} />
        <div className="flex flex-wrap items-center gap-2">
          {offer && onDelete && (
            <RecordDeleteButton
              label={l.deleteOffer}
              className={destructiveActionClass}
              disabled={pending}
              onClick={(event) => deletion.open(offer.id, event.currentTarget)}
            />
          )}
          <div className="ms-auto flex flex-wrap justify-end gap-2">
            {offer &&
              (pending ? (
                <button type="button" className={outlineButtonClass} disabled>
                  {l.cancel}
                </button>
              ) : (
                <A href={backHref} className={outlineButtonClass}>
                  {l.cancel}
                </A>
              ))}
            <button className={primaryClass} type="submit" disabled={pending}>
              {l.save}
            </button>
          </div>
        </div>
        {deletion.dialog}
      </form>
    </div>
  );
}
