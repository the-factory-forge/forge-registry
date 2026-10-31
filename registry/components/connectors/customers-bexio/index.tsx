"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { useActionToast } from "@/components/action-toast";
import type {
  BexioContactLinkActions,
  BexioContactType,
  BexioImportPreview,
} from "@/components/connectors/customers-bexio/contracts";
import { IconTooltip } from "@/components/icon-tooltip";
import { useLoadingActivity } from "@/components/loading-indicator";
import type { Customer } from "@/components/plugins/customers";
import {
  buttonClass,
  inputClass,
  outlineButtonClass,
  primaryButtonClass,
} from "@/components/plugins/customers/ui";
import { cn } from "@/components/utils/cn";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

export type {
  BexioContact,
  BexioContactLink,
  BexioContactLinkActions,
  BexioContactType,
  BexioImportPreview,
  ForgeCustomer,
} from "@/components/connectors/customers-bexio/contracts";

export { BexioSyncAllButton, type BexioSyncAllButtonProps } from "./bulk-import";
export type { BexioBulkSyncResult, BexioCustomerDirectoryActions } from "./contracts";

export const customersBexioLabels = {
  title: "Bexio contacts",
  person: "Contact person",
  company: "Company (optional)",
  searchPerson: "Search people",
  searchCompany: "Search companies",
  search: "Search Bexio",
  empty: "No matching contacts.",
  searchHint: "Enter a name or email to find a contact.",
  link: "Link",
  unlink: "Unlink locally",
  create: "Create and link",
  confirmCreate: "Confirm creation",
  createDescription:
    "Create a Bexio contact from the saved customer details? Existing exact matches must be linked instead.",
  cancel: "Cancel",
  push: "Send to Bexio",
  pull: "Review import",
  confirmImport: "Confirm import",
  importDescription:
    "These values will replace the customer's contact details. An email change may affect account access.",
  name: "Name",
  email: "Email",
  phone: "Phone",
  companyName: "Company",
  emptyValue: "None",
  linked: "Linked",
  unlinked: "Not linked",
  synced: "Synchronized",
  pending: "Synchronizing",
  error: "Needs attention",
  loading: "Loading contacts…",
  refresh: "Reload contacts",
  readError: "Could not load contacts. Retry using Reload contacts.",
  actionError: "The action failed. Review the contact details and retry.",
  saved: "Contact connection updated.",
  readOnly: "You have read-only access to this connection.",
  contactId: "Bexio ID",
};
export type CustomersBexioLabels = typeof customersBexioLabels;
export interface BexioContactLinkCardProps {
  customerId: Customer["id"];
  actions: BexioContactLinkActions;
  search: Record<BexioContactType, string>;
  onSearchChange: (type: BexioContactType, query: string) => void;
  onImported?: () => void;
  onChanged?: () => void;
  canWrite?: boolean;
  labels?: Partial<CustomersBexioLabels>;
  className?: string;
}

export function BexioContactLinkCard(props: BexioContactLinkCardProps) {
  const [owner, setOwner] = useState({ actions: props.actions, version: 0 });
  if (owner.actions !== props.actions)
    setOwner({ actions: props.actions, version: owner.version + 1 });
  return <ContactLinkCard key={`${props.customerId}:${owner.version}`} {...props} />;
}
function ContactLinkCard({
  customerId,
  actions,
  search,
  onSearchChange,
  onImported,
  onChanged,
  canWrite = true,
  labels: overrides,
  className,
}: BexioContactLinkCardProps) {
  const labels = { ...customersBexioLabels, ...overrides };
  const [cache] = useState(() => new QueryClient());
  const link = useQuery(
    { queryKey: [customerId], queryFn: () => actions.getLink(customerId), retry: false },
    cache,
  );
  const mutation = useMutationAction(actions);
  const [confirmation, setConfirmation] = useState<{
    owner: typeof actions;
    value: BexioImportPreview | BexioContactType;
  } | null>(null);
  const confirm = confirmation?.owner === actions ? confirmation.value : null;
  const notify = useActionToast();
  useLoadingActivity(link.isFetching);
  const busy = mutation.pending || link.isFetching;
  const disabled = busy || !canWrite || link.isError || link.data === undefined;
  const status = link.data?.syncStatus;
  const statusLabel = status ? labels[status] : labels.unlinked;
  const statusClass =
    status === "synced"
      ? "bg-status-success text-status-success-foreground"
      : status === "error"
        ? "bg-status-canceled text-status-canceled-foreground"
        : status === "pending"
          ? "bg-status-pending text-status-pending-foreground"
          : "bg-status-not-started text-status-not-started-foreground";

  function change(operation: () => Promise<unknown>, imported = false) {
    if (disabled) return;
    void mutation.run(
      async () => {
        const result = await operation();
        const updated = await actions.getLink(customerId);
        return { result, updated };
      },
      ({ updated }) => {
        cache.setQueryData([customerId], updated);
        setConfirmation(null);
        if (!updated?.lastError) notify(labels.saved);
        onChanged?.();
        if (imported) onImported?.();
      },
    );
  }
  return (
    <section className={cn("space-y-6", className)} aria-label={labels.title} aria-busy={busy}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md px-2 py-1 text-xs font-medium", statusClass)}>
            {statusLabel}
          </span>
          <IconTooltip label={labels.refresh}>
            <button
              type="button"
              className={buttonClass}
              aria-label={labels.refresh}
              disabled={busy}
              onClick={() => {
                setConfirmation(null);
                void cache.refetchQueries();
              }}
            >
              <RefreshCwIcon className="size-4" aria-hidden="true" />
            </button>
          </IconTooltip>
        </div>
      </header>
      {link.isPending && <output className="sr-only">{labels.loading}</output>}
      {link.isError && (
        <p role="alert" className="text-sm text-destructive">
          {labels.readError}
        </p>
      )}
      {!canWrite && <p className="text-sm text-muted-foreground">{labels.readOnly}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {(["person", "company"] as const).map((type) => (
          <ContactSection
            key={type}
            type={type}
            customerId={customerId}
            contactId={type === "person" ? link.data?.bexioPersonId : link.data?.bexioCompanyId}
            search={search[type]}
            onSearchChange={(value) => onSearchChange(type, value)}
            actions={actions}
            cache={cache}
            labels={labels}
            disabled={disabled}
            readReady={link.data !== undefined && !link.isError}
            onLink={(id) => change(() => actions.linkContact(customerId, id, type))}
            onUnlink={() => change(() => actions.unlinkContact(customerId, type))}
            onCreate={() => setConfirmation({ owner: actions, value: type })}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={disabled || !link.data}
          onClick={() => change(() => actions.syncContact(customerId))}
        >
          {labels.push}
        </button>
        <button
          type="button"
          className={outlineButtonClass}
          disabled={disabled || !link.data?.bexioPersonId}
          onClick={() => {
            void mutation.run(
              () => actions.previewImport(customerId),
              (value) => setConfirmation({ owner: actions, value }),
            );
          }}
        >
          {labels.pull}
        </button>
      </div>
      {confirm && (
        <section
          className="space-y-4 rounded-xl border border-border p-4"
          aria-label={typeof confirm === "string" ? labels.confirmCreate : labels.confirmImport}
        >
          <p className="text-sm">
            {typeof confirm === "string" ? labels.createDescription : labels.importDescription}
          </p>
          {typeof confirm !== "string" && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  [labels.name, confirm.contact.fullName],
                  [labels.email, confirm.contact.email],
                  [labels.phone, confirm.contact.phone],
                  [labels.companyName, confirm.contact.companyName],
                ] as const
              ).map(([title, value]) => (
                <div key={title}>
                  <dt className="text-muted-foreground">{title}</dt>
                  <dd className="break-words">{value || labels.emptyValue}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={disabled}
              onClick={() =>
                typeof confirm === "string"
                  ? change(() =>
                      actions.createContact({ localCustomerId: customerId, contactType: confirm }),
                    )
                  : change(() => actions.confirmImport(confirm), true)
              }
            >
              {typeof confirm === "string" ? labels.confirmCreate : labels.confirmImport}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              {labels.cancel}
            </button>
          </div>
        </section>
      )}
      {link.data?.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {link.data.lastError}
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {labels.actionError}
        </p>
      )}
    </section>
  );
}
function ContactSection({
  type,
  customerId,
  contactId,
  search,
  onSearchChange,
  actions,
  cache,
  labels,
  disabled,
  readReady,
  onLink,
  onUnlink,
  onCreate,
}: {
  type: BexioContactType;
  customerId: string;
  contactId?: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  actions: BexioContactLinkActions;
  cache: QueryClient;
  labels: CustomersBexioLabels;
  disabled: boolean;
  readReady: boolean;
  onLink: (id: number) => void;
  onUnlink: () => void;
  onCreate: () => void;
}) {
  const [draft, setDraft] = useState({ source: search, value: search });
  if (draft.source !== search) setDraft({ source: search, value: search });
  const results = useQuery(
    {
      queryKey: [customerId, type, search],
      queryFn: () => actions.searchContacts(search, type),
      enabled: readReady && !contactId && Boolean(search.trim()),
      retry: false,
    },
    cache,
  );
  useLoadingActivity(results.isFetching);
  return (
    <section className="min-w-0 space-y-3" aria-label={labels[type]}>
      <h3 className="font-medium">{labels[type]}</h3>
      {contactId ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            {labels.contactId}: <span className="font-mono">{contactId}</span>
          </p>
          <button
            type="button"
            className={outlineButtonClass}
            disabled={disabled}
            onClick={onUnlink}
          >
            {labels.unlink}
          </button>
        </div>
      ) : (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.value.trim() === search) void results.refetch();
              else onSearchChange(draft.value.trim());
            }}
          >
            <input
              aria-label={type === "person" ? labels.searchPerson : labels.searchCompany}
              className={cn(inputClass, "min-w-0 flex-1 basis-40")}
              value={draft.value}
              maxLength={200}
              onChange={(event) => setDraft({ source: search, value: event.target.value })}
            />
            <button
              type="submit"
              className={outlineButtonClass}
              disabled={!readReady || results.isFetching || !draft.value.trim()}
            >
              {labels.search}
            </button>
          </form>
          <div className="min-h-12" aria-busy={results.isFetching}>
            {results.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {labels.readError}
              </p>
            ) : results.isFetching ? (
              <output className="text-sm text-muted-foreground">{labels.loading}</output>
            ) : results.data?.length ? (
              <ul className="divide-y divide-border">
                {results.data.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="break-words">
                        {[contact.name_2, contact.name_1].filter(Boolean).join(" ")}
                      </p>
                      <p className="break-words text-muted-foreground">{contact.mail}</p>
                    </div>
                    <button
                      type="button"
                      className={outlineButtonClass}
                      disabled={disabled}
                      onClick={() => onLink(contact.id)}
                    >
                      {labels.link}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {search ? labels.empty : labels.searchHint}
              </p>
            )}
          </div>
          <button
            type="button"
            className={outlineButtonClass}
            disabled={disabled}
            onClick={onCreate}
          >
            {labels.create}
          </button>
        </>
      )}
    </section>
  );
}
