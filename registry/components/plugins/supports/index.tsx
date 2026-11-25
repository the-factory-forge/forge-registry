"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { EyeIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { LoadingBadge, LoadingSkeleton, useLoadingActivity } from "@/components/loading-indicator";
import { SupportComposer } from "@/components/plugins/supports/composer";
import {
  supportTypeShortLabels,
  supportsLabels,
  type SupportsLabels,
} from "@/components/plugins/supports/labels";
import {
  SUPPORT_DEFAULT_SORT,
  SUPPORT_SORT_FIELDS,
  SUPPORT_PAGE_SIZE,
  supportSortSchema,
  type SupportColumnSort,
} from "@/components/plugins/supports/schema";
import type {
  SupportActivity,
  SupportSort,
  SupportTicket,
  SupportsClient,
} from "@/components/plugins/supports/types";
import {
  SupportAttachments,
  SupportMarkdown,
  SupportPrioritySelect,
  SupportStatusBadge,
  SupportTypeBadge,
  buttonClass,
  inputClass,
  isSelectablePriority,
  primaryClass,
  supportError,
} from "@/components/plugins/supports/ui";
import { TablePagination } from "@/components/table-pagination";
import { TableSearch } from "@/components/table-search";
import { TableSortHeader, useTableSort, type TableSortProps } from "@/components/table-sort";
import { cn } from "@/components/utils/cn";
import {
  tablePanelClass,
  tableClass,
  tableRowClass,
  tableHeaderClass,
  tableCellClass,
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
} from "@/components/utils/table-styles";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

export type * from "./types";
export type { SupportsLabels } from "./labels";
export { supportsLabels } from "./labels";
export { SUPPORT_DEFAULT_SORT, SUPPORT_SORT_FIELDS } from "./schema";
interface Appearance {
  className?: string;
  labels?: Partial<SupportsLabels>;
  linkComponent?: ComponentType<LinkProps>;
  formatDate?: (iso: string) => string;
}
const formatDateDefault = (iso: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
export interface SupportCreateDialogProps extends Appearance {
  client: SupportsClient;
  onCreated?: (ticket: SupportTicket) => void;
  disabled?: boolean;
}
export function SupportCreateDialog({
  client,
  onCreated,
  disabled,
  labels: overrides,
  className,
}: SupportCreateDialogProps) {
  const labels = { ...supportsLabels, ...overrides };
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <ActionToastProvider closeLabel={labels.close}>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <Dialog.Trigger disabled={disabled} className={cn(primaryClass, className)}>
          <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
          {labels.add}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background px-6 text-foreground shadow-lg">
            <div className="sticky top-0 z-10 -mx-6 space-y-2 bg-background px-6 pt-5 pb-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="text-lg font-semibold">{labels.createTitle}</Dialog.Title>
                <IconTooltip label={labels.close}>
                  <Dialog.Close
                    disabled={pending}
                    aria-label={labels.close}
                    className={cn(buttonClass, "size-8 shrink-0 p-0")}
                  >
                    <XIcon aria-hidden="true" className="size-4" />
                  </Dialog.Close>
                </IconTooltip>
              </div>
              <Dialog.Description className="text-sm text-muted-foreground">
                {labels.instructions}
              </Dialog.Description>
            </div>
            <div className="pb-5">
              <SupportComposer
                client={client}
                labels={labels}
                onPendingChange={setPending}
                onCancel={() => setOpen(false)}
                onCreated={(ticket) => {
                  setPending(false);
                  setOpen(false);
                  onCreated?.(ticket);
                }}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ActionToastProvider>
  );
}
export interface SupportsPageProps extends Appearance {
  client: SupportsClient;
  renderStatus?: (ticketId: string) => ReactNode;
  tickets: readonly SupportTicket[];
  total: number;
  search: string;
  page: number;
  sort?: SupportSort;
  onSortChange?: TableSortProps<SupportColumnSort["field"]>["onSortChange"];
  sortStorageKey?: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  getTicketHref: (ticket: SupportTicket) => string;
  onChanged?: () => void;
  onCreated?: (ticket: SupportTicket) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
}
function SupportsContent({
  client,
  renderStatus,
  tickets,
  total,
  search,
  page,
  sort,
  onSortChange,
  sortStorageKey,
  onSearchChange,
  onPageChange,
  getTicketHref,
  onChanged,
  onCreated,
  loading,
  error,
  onRetry,
  onRefresh,
  labels: overrides,
  linkComponent: TicketLink = Link,
  formatDate = formatDateDefault,
  className,
}: SupportsPageProps) {
  const labels = { ...supportsLabels, ...overrides };
  const toast = useActionToast();
  const order = useTableSort<SupportColumnSort["field"]>(
    {
      sort: supportSortSchema.safeParse(sort).data,
      onSortChange,
      sortStorageKey,
      sortLabels: labels,
    },
    SUPPORT_DEFAULT_SORT,
    undefined,
    onSortChange
      ? { owner: "supports", key: "queue", legacyKey: "supports", fields: SUPPORT_SORT_FIELDS }
      : undefined,
  );
  const activeSort = order.value ?? SUPPORT_DEFAULT_SORT;
  const { field, direction } = activeSort;
  const scope = useMemo(
    () => ({ client, search, page, field, direction }),
    [client, search, page, field, direction],
  );
  const cancellation = useOptimisticAction(tickets, scope);
  useLoadingActivity(Boolean(loading));
  return (
    <section className={cn("min-w-0 text-foreground", className)}>
      <div className={cn(tablePanelClass, "space-y-5")}>
        <header className="flex flex-wrap items-center gap-x-2 gap-y-4">
          <div className="flex min-w-0 flex-1 basis-64 items-center justify-between gap-4">
            <h1 className="font-sans text-base font-semibold wrap-anywhere">{labels.title}</h1>
            <TableSearch
              className="min-w-10 shrink md:min-w-8"
              value={search}
              onValueChange={onSearchChange}
              label={labels.search}
              clearLabel={labels.clearSearch}
              maxLength={250}
            />
          </div>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            {onRefresh && (
              <IconTooltip label={labels.refresh}>
                <button
                  type="button"
                  aria-label={labels.refresh}
                  disabled={loading}
                  className={cn(buttonClass, "size-10 rounded-md p-0 md:size-8")}
                  onClick={onRefresh}
                >
                  <RefreshCwIcon className="size-4" aria-hidden="true" />
                </button>
              </IconTooltip>
            )}
            <SupportCreateDialog client={client} labels={labels} onCreated={onCreated} />
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className={tableClass} aria-busy={loading}>
            <thead>
              <tr>
                {(
                  [
                    ["title", labels.ticketTitle],
                    ["status", labels.status],
                    ["priority", labels.priority],
                    ["author", labels.author],
                    ["updatedAt", labels.updated],
                  ] as const
                ).map(([column, label]) => {
                  if (column === "priority") {
                    return client.setPriority ? (
                      <th key={column} scope="col" className={tableHeaderClass}>
                        {label}
                      </th>
                    ) : null;
                  }

                  return (
                    <TableSortHeader
                      key={column}
                      field={column}
                      label={label}
                      {...order}
                      onValueChange={onSortChange ? order.onValueChange : undefined}
                    />
                  );
                })}
                <th scope="col" className={tableActionHeaderClass}>
                  <span className="sr-only">{labels.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cancellation.error && (
                <tr>
                  <td colSpan={client.setPriority ? 6 : 5} className="p-4">
                    <p role="alert" className="text-destructive">
                      {supportError(cancellation.error, {
                        ...labels,
                        saveError: labels.cancelError,
                      })}
                    </p>
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={client.setPriority ? 6 : 5} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p role="alert" className="text-destructive">
                        {labels.loadError}
                      </p>
                      {onRetry && (
                        <button type="button" className={buttonClass} onClick={onRetry}>
                          {labels.retry}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!tickets.length && !error && (
                <tr>
                  <td
                    colSpan={client.setPriority ? 6 : 5}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <output>{loading ? labels.loading : labels.empty}</output>
                  </td>
                </tr>
              )}
              {cancellation.value.map((ticket) => (
                <tr key={ticket.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <TicketLink
                      href={getTicketHref(ticket)}
                      className="inline-block min-h-10 content-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring md:min-h-8"
                    >
                      <span className="text-muted-foreground">
                        {overrides?.[ticket.type] ?? supportTypeShortLabels[ticket.type]}:
                      </span>{" "}
                      {ticket.title}
                    </TicketLink>
                  </td>
                  <td className={tableCellClass}>
                    {renderStatus?.(ticket.id) ?? (
                      <SupportStatusBadge status={ticket.status} labels={labels} />
                    )}
                  </td>
                  {client.setPriority && (
                    <td className={cn(tableCellClass, "whitespace-nowrap")}>
                      {isSelectablePriority(ticket.priority) ? (
                        labels[ticket.priority]
                      ) : (
                        <span className="text-muted-foreground">{labels.noPriority}</span>
                      )}
                    </td>
                  )}
                  <td className={tableCellClass}>{ticket.author.name}</td>
                  <td className={cn(tableCellClass, "whitespace-nowrap tabular-nums")}>
                    <time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
                  </td>
                  <td className={tableActionCellClass} aria-label={labels.actions}>
                    <div className={tableActionsClass}>
                      <IconTooltip label={labels.view}>
                        <TicketLink
                          href={getTicketHref(ticket)}
                          aria-label={`${labels.view}: ${ticket.title}`}
                          className={cn(buttonClass, "size-10 p-0 md:size-8")}
                        >
                          <EyeIcon className="size-4 shrink-0" aria-hidden="true" />
                        </TicketLink>
                      </IconTooltip>
                      <IconTooltip label={labels.cancelTicket}>
                        <button
                          type="button"
                          aria-label={`${labels.cancelTicket}: ${ticket.title}`}
                          className={cn(
                            buttonClass,
                            "size-10 p-0 enabled:text-destructive md:size-8",
                          )}
                          disabled={
                            ticket.status !== "open" || loading || error || cancellation.pending
                          }
                          onClick={() => {
                            void cancellation
                              .run(
                                (current) =>
                                  current.map((entry) =>
                                    entry.id === ticket.id
                                      ? { ...entry, status: "canceled" }
                                      : entry,
                                  ),
                                () => client.setStatus(ticket.id, "canceled"),
                                () => {
                                  toast(labels.statusSaved);
                                  onChanged?.();
                                },
                              )
                              .catch(() => {});
                          }}
                        >
                          <XIcon className="size-4 shrink-0" aria-hidden="true" />
                        </button>
                      </IconTooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          summary={labels.total(total)}
          page={page}
          pageCount={Math.max(1, Math.ceil(total / SUPPORT_PAGE_SIZE))}
          previousDisabled={page <= 1}
          nextDisabled={page * SUPPORT_PAGE_SIZE >= total}
          disabled={loading}
          onPrevious={() => onPageChange(page - 1)}
          onNext={() => onPageChange(page + 1)}
          label={labels.pagination}
          previousLabel={labels.previous}
          nextLabel={labels.next}
        />
      </div>
    </section>
  );
}
export function SupportsPage(props: SupportsPageProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <SupportsContent {...props} />
    </ActionToastProvider>
  );
}
export interface SupportDetailPageProps extends Appearance {
  integrationContent?: ReactNode;
  attachmentNote?: string;
  statusBadge?: ReactNode;
  client: SupportsClient;
  ticket: SupportTicket;
  activity: readonly SupportActivity[];
  backHref: string;
  onChanged: () => void;
  onLoadMore?: () => void;
  loading?: boolean;
  error?: boolean;
}
export type SupportDetailPageLoadingProps = Pick<
  SupportDetailPageProps,
  "backHref" | "className" | "labels" | "linkComponent"
> & { ticket: null };

function DetailContent({
  integrationContent,
  attachmentNote,
  statusBadge,
  client,
  ticket,
  activity,
  onChanged,
  onLoadMore,
  loading,
  error,
  labels: overrides,
  formatDate = formatDateDefault,
}: SupportDetailPageProps) {
  const labels = { ...supportsLabels, ...overrides };
  const toast = useActionToast();
  const scope = useMemo(() => ({ client, id: ticket.id }), [client, ticket.id]);
  const status = useOptimisticAction(ticket.status, scope);
  const notifications = Toast.useToastManager();
  const priority = useOptimisticAction(ticket.priority ?? null, scope);
  const [closeScope, setCloseScope] = useState<typeof scope | null>(null);
  const statusButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirming = closeScope === scope;
  const dangerClass =
    "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30 disabled:border-border disabled:bg-muted disabled:text-muted-foreground dark:disabled:bg-muted";
  function changeStatus(next: "open" | "closed") {
    void status
      .run(
        () => next,
        () => client.setStatus(ticket.id, next),
        () => {
          setCloseScope(null);
          toast(labels.statusSaved);
          onChanged();
        },
      )
      .catch(() => {});
  }
  useLoadingActivity(Boolean(loading));
  return (
    <>
      <SupportComposer
        key={ticket.id}
        client={client}
        ticketId={ticket.id}
        labels={labels}
        onChanged={onChanged}
        actions={
          <button
            ref={statusButton}
            className={cn(buttonClass, status.value === "open" && dangerClass)}
            disabled={loading || status.pending}
            type="button"
            onClick={() => {
              if (status.value === "open") setCloseScope(scope);
              else changeStatus("open");
            }}
          >
            {status.value === "open" ? labels.closeTicket : labels.reopen}
          </button>
        }
      >
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-2xl font-semibold break-words">{ticket.title}</h1>
            {statusBadge ?? <SupportStatusBadge status={status.value} labels={labels} />}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SupportTypeBadge type={ticket.type} labels={labels} />
            <span>{ticket.author.name}</span>
            <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time>
          </div>
          {client.setPriority && (
            <div className="w-fit max-w-full">
              <SupportPrioritySelect
                value={priority.value}
                disabled={priority.pending}
                labels={labels}
                onChange={(next) => {
                  void priority
                    .run(
                      () => next,
                      () => client.setPriority!(ticket.id, next).finally(onChanged),
                      () => toast(labels.prioritySaved),
                    )
                    .catch(() => {
                      if (priority.isCurrent())
                        notifications.add({ title: labels.priorityError, type: "error" });
                    });
                }}
              />
            </div>
          )}
        </header>
        {integrationContent}
        {status.error && !confirming && (
          <p role="alert" className="text-sm text-destructive">
            {supportError(status.error, labels)}
          </p>
        )}
        {error && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm text-destructive">
              {labels.loadError}
            </p>
            <button className={buttonClass} type="button" onClick={onChanged}>
              {labels.retry}
            </button>
          </div>
        )}
        <SupportMarkdown value={ticket.description} />
        <SupportAttachments
          files={ticket.attachments}
          client={client}
          labels={labels}
          note={attachmentNote}
        />
        <section className="space-y-5 border-t border-border pt-5" aria-label={labels.discussion}>
          <h2 className="text-lg font-semibold">{labels.discussion}</h2>
          {!activity.length && <p className="text-sm text-muted-foreground">{labels.noActivity}</p>}
          <ol className="space-y-5">
            {activity.map((entry) => (
              <li key={entry.id} className="min-w-0 space-y-3 border-b border-border pb-5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{entry.author.name}</span>
                  {entry.kind === "status" && (
                    <span>
                      {entry.status === "canceled"
                        ? labels.canceledActivity
                        : entry.status === "closed"
                          ? labels.closedActivity
                          : labels.reopenedActivity}
                    </span>
                  )}
                  <time
                    className="ml-auto text-xs text-muted-foreground"
                    dateTime={entry.createdAt}
                  >
                    {formatDate(entry.createdAt)}
                  </time>
                </div>
                {entry.body && <SupportMarkdown value={entry.body} />}
                <SupportAttachments
                  files={entry.attachments}
                  client={client}
                  labels={labels}
                  note={attachmentNote}
                />
              </li>
            ))}
          </ol>
          {onLoadMore && (
            <button className={buttonClass} disabled={loading} onClick={onLoadMore} type="button">
              {labels.loadMore}
            </button>
          )}
        </section>
      </SupportComposer>
      <Dialog.Root
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !status.pending) setCloseScope(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            initialFocus={cancelButton}
            finalFocus={statusButton}
            className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto rounded-xl border border-border bg-card px-6 text-card-foreground shadow-xl"
          >
            <div
              data-dialog-header
              className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-card px-6 pt-5 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80"
            >
              <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
                {labels.closeTitle}
              </Dialog.Title>
              <IconTooltip label={labels.close}>
                <Dialog.Close
                  type="button"
                  aria-label={labels.close}
                  disabled={status.pending}
                  className={cn(buttonClass, "size-10 p-0 md:size-8")}
                >
                  <XIcon className="size-4 shrink-0" aria-hidden="true" />
                </Dialog.Close>
              </IconTooltip>
            </div>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.closeDescription}
            </Dialog.Description>
            <div className="min-h-5 text-sm text-destructive">
              {status.error && <p role="alert">{supportError(status.error, labels)}</p>}
            </div>
            <div
              data-dialog-footer
              className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-card px-6 pt-0 pb-5 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80"
            >
              <Dialog.Close ref={cancelButton} className={buttonClass} disabled={status.pending}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                className={cn(buttonClass, dangerClass)}
                disabled={loading || status.pending || status.value !== "open"}
                aria-busy={status.pending}
                onClick={() => changeStatus("closed")}
              >
                {status.pending ? labels.saving : labels.closeTicket}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
export function SupportDetailPage(props: SupportDetailPageProps | SupportDetailPageLoadingProps) {
  const labels = { ...supportsLabels, ...props.labels };
  useLoadingActivity(props.ticket === null);
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <article
        className={cn("mx-auto max-w-4xl min-w-0 space-y-6 text-foreground", props.className)}
      >
        <BackLink linkComponent={props.linkComponent ?? Link} href={props.backHref}>
          {labels.back}
        </BackLink>
        {props.ticket === null ? (
          <>
            <header className="space-y-3">
              <div className="flex min-h-8 items-start justify-between gap-3">
                <LoadingSkeleton className="my-1 h-6 w-64 max-w-3/5" />
                <LoadingBadge label={labels.loading} />
              </div>
              <LoadingSkeleton className="h-5 w-48 max-w-full" />
            </header>
            <div aria-busy="true" className="space-y-6">
              <LoadingSkeleton className="h-12 w-full" />
              <label className="block space-y-2 text-sm font-medium">
                <span>{labels.reply}</span>
                <textarea disabled className={cn(inputClass, "min-h-32 resize-y")} />
              </label>
            </div>
          </>
        ) : (
          <DetailContent key={props.ticket.id} {...props} />
        )}
      </article>
    </ActionToastProvider>
  );
}
