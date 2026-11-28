"use client";
import {
  DownloadIcon,
  EyeIcon,
  MailIcon,
  PanelRightIcon,
  Trash2Icon,
  SendIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useId, useState, type ComponentType, type ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";
import { Link, type LinkProps } from "@/components/link";
import { Feedback, StatusBadge, useCustomerAction } from "@/components/plugins/customers/ui";
import {
  OfferAddresses,
  OfferLinePosition,
  OfferLineTable,
  offerEditorLabels,
  offerNumericColumnClass,
} from "@/components/plugins/offers/editor";
import { InlineOfferField } from "@/components/plugins/offers/inline-field";
import { offerLabels, type OfferLabels } from "@/components/plugins/offers/labels";
import {
  editLine,
  readLine,
  useOfferLineOrder,
  type OfferLineDraft,
} from "@/components/plugins/offers/line-draft";
import { OfferBadge } from "@/components/plugins/offers/list";
import {
  emptyLine,
  lineAmounts,
  formatOfferNumber,
  moneyFormatter,
  offerTotals,
  offerInputSchema,
  offerLineSchema,
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
  outlineButtonClass,
  primaryClass,
} from "@/components/utils/table-controls";
import {
  tableActionCellClass,
  tablePanelClass,
  tableCellClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { viewPreferenceKey } from "@/components/utils/view-preference";

const sidebarCardClass =
  "rounded-xl border border-border bg-card px-4 pb-4 text-card-foreground @min-[64rem]/content-sidebar:max-h-[calc(100dvh-var(--intranet-top-offset,0rem)-2rem)] @min-[64rem]/content-sidebar:overflow-y-auto";
const sidebarHeadingClass =
  "sticky top-[var(--offer-host-offset)] z-10 bg-card text-sm font-semibold @min-[64rem]/content-sidebar:top-0 supports-backdrop-filter:bg-card/60 supports-backdrop-filter:backdrop-blur-sm";
const sidebarControlsClass = "flex flex-wrap gap-1 @min-[64rem]/content-sidebar:flex-col";
const sidebarButtonClass = cn(buttonClass, "justify-start text-start");

const rowButtonClass = cn(iconButtonClass, "border-0 bg-transparent md:size-7 md:min-h-7");
const rowControlClass =
  "group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 print:hidden";

type DraftValues = Omit<OfferInput, "lines"> & { lines: OfferLineDraft[] };
type DraftSession = {
  version: number;
  initial: DraftValues;
  values: DraftValues;
};

export interface OfferDetailProps {
  offer: Offer;
  sender?: OfferSender;
  customer: OfferRecipient;
  locale: string;
  backHref: string;
  customerHref: string;
  /** @deprecated Supply onSave for inline editing. */
  editHref?: string;
  pdfHref?: string;
  pdfFallback?: ReactNode;
  onSave?: (version: number, values: OfferInput) => Promise<void>;
  onDelete?: (id: string, version: number) => Promise<void>;
  renderProductPicker?: (add: (line: OfferLine) => void) => ReactNode;
  onIssue?: (version: number) => Promise<void>;
  onDecision?: (version: number, decision: "accepted" | "declined") => Promise<void>;
  onSend?: (issuedToken: string) => Promise<void>;
  labels?: Partial<OfferLabels & typeof offerEditorLabels>;
  linkComponent?: ComponentType<LinkProps>;
}

export function OfferDetail(props: OfferDetailProps) {
  return <OfferDetailContent key={props.offer.id} {...props} />;
}

function OfferDetailContent({
  offer,
  sender,
  customer,
  locale,
  backHref,
  onSave,
  onDelete,
  renderProductPicker,
  pdfHref,
  pdfFallback,
  onIssue,
  onDecision,
  onSend,
  labels,
  linkComponent: A = Link,
}: OfferDetailProps) {
  const l = { ...offerLabels, ...offerEditorLabels, ...labels };
  const [showIssued, setShowIssued] = useState(false);
  const reviewingDraft = !!offer.draft && (!offer.issued || !showIssued);
  const content = reviewingDraft ? offer.draft! : offer.issued!.content;
  const { digits, format: money } = moneyFormatter(offer.currency, locale);
  const [draft, setDraft] = useState<DraftSession | null>(null);
  const [newLine, setNewLine] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const canEdit = !!onSave && (reviewingDraft || !offer.draft);
  const base = {
    ...content,
    lines: content.lines.map((line, i) => editLine(line, digits, String(i))),
  };
  const values = draft?.values ?? base;
  const parsed = values.lines.map((line) => readLine(line, digits));
  const validAmounts = parsed.map(
    (line) => offerLineSchema.safeParse({ ...line, description: "—" }).success,
  );
  const totals = validAmounts.every(Boolean) ? offerTotals(parsed) : undefined;
  const action = useCustomerAction(l.failed, offer.id);
  const saveAction = useCustomerAction(l.failed, offer.id);
  const recipient = reviewingDraft ? customer : offer.issued!.recipient;
  const titleId = `factory-offer-title-${useId()}`;
  const sidebarId = `factory-offer-sidebar-${useId()}`;
  const issued = reviewingDraft ? null : offer.issued;
  const issue = reviewingDraft && onIssue;
  const decide = issued && offer.status === "pending" && onDecision;
  const hasActions = onDelete || issue || decide;
  const sent = !!issued && !!offer.sentAt;
  const hasSend = issued && (pdfHref || pdfFallback || onSend || sent);
  const hasSidebar = hasActions || hasSend;
  const deletion = useRecordDeletion({
    items: [offer],
    scope: offer.id,
    getName: (item) => formatOfferNumber(item.number),
    onDelete: onDelete ? (id) => onDelete(id, offer.version) : undefined,
    label: l.deleteOffer,
    labels: { ...l, actionError: l.failed, pending: l.deleting },
    disabled: action.pending || saveAction.pending || !!draft,
  });
  const pending = action.pending || saveAction.pending || deletion.pending;
  const editable = canEdit && !pending;

  function update(apply: (previous: DraftValues) => DraftValues) {
    if (!editable) return;
    setInvalid(false);
    setDraft((previous) => {
      const initial = previous?.initial ?? base;
      const next = apply(previous?.values ?? initial);
      if (JSON.stringify(next) === JSON.stringify(initial)) return null;
      return { version: previous?.version ?? offer.version, initial, values: next };
    });
  }

  function updateLines(apply: (lines: OfferLineDraft[]) => OfferLineDraft[]) {
    update((previous) => ({ ...previous, lines: apply(previous.lines) }));
  }

  function add(line: OfferLine, focus = false) {
    if (values.lines.length >= 200) return;
    const next = editLine(line, digits, crypto.randomUUID());
    if (focus) setNewLine(next.key);
    updateLines((lines) => (lines.length < 200 ? [...lines, next] : lines));
  }

  function save() {
    if (!onSave || !draft || pending) return;
    const input = offerInputSchema.safeParse({ ...values, lines: parsed });
    if (!input.success) {
      setInvalid(true);
      return;
    }
    void saveAction.run(
      () => onSave(draft.version, input.data),
      l.saved,
      () => {
        setDraft(null);
        setShowIssued(false);
      },
    );
  }

  function field(name: "title" | "date" | "validUntil" | "notes" | "terms") {
    const date = name === "date" || name === "validUntil";
    const multiline = name === "terms" || name === "notes";
    return (
      <InlineOfferField
        label={l[name]}
        value={values[name]}
        onChange={
          editable ? (value) => update((previous) => ({ ...previous, [name]: value })) : undefined
        }
        type={date ? "date" : multiline ? "textarea" : "text"}
        min={name === "validUntil" ? values.date : undefined}
        maxLength={multiline ? 5000 : date ? undefined : 200}
        indicator={date || name === "title"}
      />
    );
  }

  const order = useOfferLineOrder(values.lines, updateLines, !editable);

  function lineField(
    line: OfferLineDraft,
    i: number,
    name: Exclude<keyof OfferLineDraft, "key">,
    label: string,
    display?: string,
  ) {
    const description = name === "description";
    const unit = name === "unit";
    return (
      <InlineOfferField
        label={label + " " + (i + 1)}
        value={line[name]}
        display={display}
        onChange={
          editable
            ? (value) =>
                updateLines((lines) =>
                  lines.map((item) => (item.key === line.key ? { ...item, [name]: value } : item)),
                )
            : undefined
        }
        type={description ? "textarea" : unit ? "text" : "decimal"}
        maxLength={description ? 2000 : unit ? 40 : undefined}
        contentEditable
        startEditing={description && newLine === line.key}
      />
    );
  }

  return (
    <article className="@container/offer-detail space-y-4 [--offer-host-offset:var(--intranet-top-offset,0rem)] [--offer-toolbar-clearance:--spacing(12)]">
      <BackLink href={backHref} linkComponent={A}>
        {l.back}
      </BackLink>
      <ContentSidebarLayout
        className="[--intranet-top-offset:calc(var(--offer-host-offset)+var(--offer-toolbar-clearance))]"
        defaultOpen
        preferenceKey={viewPreferenceKey("offers", "detail", "actions")}
        renderHeader={(open, setOpen) => (
          <header
            className={cn(
              "flex flex-wrap items-center gap-2",
              hasSidebar &&
                "@min-[64rem]/offer-detail:sticky @min-[64rem]/offer-detail:top-[calc(var(--offer-host-offset)+1rem)] @min-[64rem]/offer-detail:z-20 @min-[64rem]/offer-detail:bg-background @min-[64rem]/offer-detail:supports-backdrop-filter:bg-background/80 @min-[64rem]/offer-detail:supports-backdrop-filter:backdrop-blur-sm print:static",
            )}
          >
            <p className="font-semibold">{formatOfferNumber(offer.number)}</p>
            <div className="ms-auto flex items-center">
              <OfferBadge status={reviewingDraft ? "draft" : offer.status} labels={l} />
            </div>
            {hasSidebar && (
              <div
                className={cn(
                  "flex shrink-0 justify-end print:hidden",
                  open && "@min-[64rem]/offer-detail:ms-4 @min-[64rem]/offer-detail:w-[22rem]",
                )}
              >
                <IconTooltip label={l.actions} disabled={open}>
                  <button
                    type="button"
                    aria-label={l.actions}
                    aria-expanded={open}
                    aria-controls={open ? sidebarId : undefined}
                    className={cn(
                      open ? cn(primaryClass, "border border-primary") : outlineButtonClass,
                      "gap-0 px-2.75 md:px-1.75",
                    )}
                    onClick={() => setOpen(!open)}
                  >
                    <PanelRightIcon className="shrink-0" aria-hidden="true" />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid motion-safe:transition-[grid-template-columns] motion-safe:duration-150",
                        open ? "grid-cols-[1fr] ease-out" : "grid-cols-[0fr] ease-in",
                      )}
                    >
                      <span className="min-w-0 overflow-hidden whitespace-nowrap">
                        <span className="ps-2">{l.actions}</span>
                      </span>
                    </span>
                  </button>
                </IconTooltip>
              </div>
            )}
          </header>
        )}
        sidebar={
          hasSidebar ? (
            <aside
              id={sidebarId}
              aria-labelledby={sidebarId + (hasActions ? "-actions" : "-send")}
              className={sidebarCardClass}
            >
              {hasActions && (
                <div className="pt-4">
                  <header
                    className={cn(
                      sidebarHeadingClass,
                      "flex items-center justify-between gap-2",
                      (issue || decide) && "mb-2 border-b border-border pb-3",
                    )}
                  >
                    <h2 id={sidebarId + "-actions"}>{l.actions}</h2>
                    {onDelete && (
                      <RecordDeleteButton
                        label={l.deleteOffer}
                        className={destructiveActionClass}
                        disabled={pending || !!draft}
                        onClick={(event) => deletion.open(offer.id, event.currentTarget)}
                      />
                    )}
                  </header>
                  <div className={sidebarControlsClass}>
                    {issue && (
                      <button
                        type="button"
                        disabled={pending || !!draft || !content.lines.length}
                        className={cn(primaryClass, "justify-start text-start")}
                        onClick={() => void action.run(() => issue(offer.version), l.updated)}
                      >
                        <SendIcon aria-hidden="true" />
                        {offer.issued ? l.reissue : l.issue}
                      </button>
                    )}
                    {decide &&
                      (
                        [
                          ["accepted", l.accept, ThumbsUpIcon],
                          ["declined", l.decline, ThumbsDownIcon],
                        ] as const
                      ).map(([decision, label, Icon]) => (
                        <button
                          key={decision}
                          type="button"
                          className={sidebarButtonClass}
                          disabled={pending || !!draft}
                          onClick={() =>
                            void action.run(() => decide(offer.version, decision), l.updated)
                          }
                        >
                          <Icon aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {hasSend && (
                <div className={hasActions ? "mt-6" : "pt-4"}>
                  <h2
                    id={sidebarId + "-send"}
                    className={cn(sidebarHeadingClass, "mb-2 border-b border-border pb-3")}
                  >
                    {l.sendHeading}
                  </h2>
                  <div className={sidebarControlsClass}>
                    {pdfHref ? (
                      <>
                        <a
                          className={sidebarButtonClass}
                          href={pdfHref}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <EyeIcon aria-hidden="true" />
                          {l.preview}
                        </a>
                        <a
                          className={sidebarButtonClass}
                          href={pdfHref}
                          download={`offer-${offer.number}.pdf`}
                        >
                          <DownloadIcon aria-hidden="true" />
                          {l.pdf}
                        </a>
                      </>
                    ) : (
                      pdfFallback
                    )}
                    {(onSend || sent) && (
                      <div className="flex flex-wrap items-center gap-1">
                        {onSend ? (
                          <button
                            type="button"
                            className={cn(sidebarButtonClass, !sent && "grow")}
                            disabled={pending || !!draft || sent}
                            onClick={() => void action.run(() => onSend(issued.token), l.sent)}
                          >
                            <MailIcon aria-hidden="true" />
                            {l.send}
                          </button>
                        ) : (
                          <span className="px-3 py-2 text-sm">{l.emailStatus}</span>
                        )}
                        {sent && (
                          <StatusBadge
                            value="sent"
                            options={[{ value: "sent", label: l.sent }]}
                            label={l.emailStatus}
                            className="bg-status-success text-status-success-foreground"
                            successMessage=""
                            errorMessage=""
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!draft && action.feedback && (
                <div className="mt-3">
                  <Feedback feedback={action.feedback} />
                </div>
              )}
            </aside>
          ) : undefined
        }
      >
        <section aria-labelledby={titleId} className={tablePanelClass + " space-y-5"}>
          {offer.issued && offer.draft && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending || !!draft}
                aria-pressed={reviewingDraft}
                className={reviewingDraft ? primaryClass : outlineButtonClass}
                onClick={() => setShowIssued(false)}
              >
                {l.draft}
              </button>
              <button
                type="button"
                disabled={pending || !!draft}
                aria-pressed={!reviewingDraft}
                className={reviewingDraft ? outlineButtonClass : primaryClass}
                onClick={() => setShowIssued(true)}
              >
                {l.issued}
              </button>
            </div>
          )}
          <div className="hidden print:block">
            <OfferAddresses sender={issued ?? sender} recipient={recipient} labels={l} />
          </div>
          <header>
            <h1
              id={titleId}
              aria-label={values.title || l.title}
              className="border-b border-border pb-2 text-xl font-semibold wrap-anywhere"
            >
              {field("title")}
            </h1>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-border py-3 text-sm">
              <dt>{l.date}</dt>
              <dd className="tabular-nums">{field("date")}</dd>
              <dt>{l.validUntil}</dt>
              <dd className="tabular-nums">{field("validUntil")}</dd>
            </dl>
          </header>
          {content.notes && (
            <section className="text-sm">
              <h2 className="font-semibold">{l.notes}</h2>
              <div className={!values.notes ? "text-muted-foreground" : undefined}>
                {field("notes")}
              </div>
            </section>
          )}
          <OfferLineTable
            labels={l}
            money={money}
            totals={totals}
            lineActions={canEdit}
            inlineEditing={canEdit}
            onAddLine={canEdit ? () => add(emptyLine(), true) : undefined}
            addLineDisabled={!editable || values.lines.length >= 200}
          >
            {values.lines.map((line, i) => (
              <tr
                className={cn(tableRowClass, "group/offer-line", order.rowClass(line.key))}
                key={line.key}
              >
                <OfferLinePosition
                  position={i + 1}
                  labels={l}
                  controls={canEdit ? order.controls(line.key, i) : undefined}
                />
                <td className={cn(tableCellClass, "wrap-anywhere")}>
                  {lineField(line, i, "description", l.description)}
                </td>
                <td className={cn(tableCellClass, "text-end tabular-nums")}>
                  <div className="flex flex-wrap items-center justify-end gap-x-1">
                    {lineField(line, i, "quantityMilli", l.quantity)}
                    {(canEdit || line.unit) &&
                      lineField(line, i, "unit", l.unit, line.unit || (canEdit ? "—" : ""))}
                  </div>
                </td>
                {(
                  [
                    [
                      "priceMinor",
                      l.price,
                      validAmounts[i] ? money(parsed[i].priceMinor) : line.priceMinor,
                    ],
                    ["discountBps", l.discount, line.discountBps && line.discountBps + "%"],
                    ["taxBps", l.tax, line.taxBps && line.taxBps + "%"],
                  ] as const
                ).map(([name, label, display]) => (
                  <td key={name} className={cn(tableCellClass, offerNumericColumnClass)}>
                    {lineField(line, i, name, label, display)}
                  </td>
                ))}
                <td className={cn(tableCellClass, offerNumericColumnClass)}>
                  {validAmounts[i] ? money(lineAmounts(parsed[i]).net) : "—"}
                </td>
                {canEdit && (
                  <td className={cn(tableActionCellClass, "py-0 print:hidden")}>
                    <IconTooltip label={l.remove}>
                      <button
                        type="button"
                        aria-label={l.remove}
                        className={cn(rowButtonClass, destructiveActionClass, rowControlClass)}
                        disabled={!editable}
                        onClick={() =>
                          updateLines((lines) => lines.filter((item) => item.key !== line.key))
                        }
                      >
                        <Trash2Icon aria-hidden="true" />
                      </button>
                    </IconTooltip>
                  </td>
                )}
              </tr>
            ))}
          </OfferLineTable>
          {canEdit && renderProductPicker && values.lines.length < 200 && (
            <details className="text-sm print:hidden">
              <summary className="w-fit cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
                {l.selectProduct}
              </summary>
              <fieldset disabled={!editable} className="mt-2">
                {renderProductPicker(add)}
              </fieldset>
            </details>
          )}
          {(values.terms || canEdit) && (
            <section className={cn("text-sm", !values.terms && "print:hidden")}>
              {values.terms && <h2 className="font-semibold">{l.terms}</h2>}
              <div>{field("terms")}</div>
            </section>
          )}
          {!content.notes && (canEdit || values.notes) && (
            <div className={cn("text-sm", !values.notes && "text-muted-foreground print:hidden")}>
              {field("notes")}
            </div>
          )}
          {draft && (
            <Feedback
              feedback={invalid ? { error: true, message: l.invalid } : saveAction.feedback}
            />
          )}
          {draft && (
            <div className="flex flex-wrap justify-end gap-2 print:hidden">
              <button
                type="button"
                className={outlineButtonClass}
                disabled={pending}
                onClick={() => {
                  setDraft(null);
                  setInvalid(false);
                }}
              >
                {l.cancel}
              </button>
              <button type="button" className={primaryClass} disabled={pending} onClick={save}>
                {l.save}
              </button>
            </div>
          )}
        </section>
      </ContentSidebarLayout>
      {deletion.dialog}
    </article>
  );
}
