"use client";

import { ArrowLeftIcon, FolderKanbanIcon, PencilIcon, PlusIcon, UserRoundIcon } from "lucide-react";

import { ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { CustomerForm } from "@/components/plugins/customers/customer-form";
import { customerLabels } from "@/components/plugins/customers/labels";
import type {
  CustomerDetailPageProps,
  CustomerNewPageProps,
  CustomerSection,
  CustomersPageProps,
} from "@/components/plugins/customers/types";
import {
  buttonClass,
  cardClass,
  CustomerActionButton,
  CustomerAvatar,
  CustomerStatusBadge,
  DeleteCustomer,
  iconButtonClass,
  primaryButtonClass,
} from "@/components/plugins/customers/ui";
import { customerDisplayName } from "@/components/plugins/customers/utils";
import { TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems, useOptimisticAction } from "@/components/utils/use-optimistic-action";

export type {
  Customer,
  CustomerFormValues,
  CustomerCreateValues,
  CustomerSection,
  CustomersPageProps,
  CustomerDetailPageProps,
  CustomerNewPageProps,
} from "@/components/plugins/customers/types";
export type { CustomersLabels } from "@/components/plugins/customers/labels";

const pageClass = "mx-auto w-full min-w-0 space-y-6 px-4 py-8 text-foreground";

function CustomersPageContent({
  customers: suppliedCustomers,
  search,
  onSearchChange,
  loading = false,
  error: loadError,
  createHref,
  getCustomerHref,
  onDelete,
  onSetVerified,
  onImpersonate,
  toolbar,
  syncColumn,
  className,
  labels: overrides,
  linkComponent: CustomerLink = Link,
}: CustomersPageProps) {
  const labels = { ...customerLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedCustomers);
  const customers = optimistic.value;
  const error = loadError || (optimistic.error ? labels.actionError : undefined);
  return (
    <div className={cn(pageClass, className)}>
      <section className={cn(tablePanelClass, "space-y-5")} aria-label={labels.title}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-base font-semibold">{labels.title}</h1>
            <p className="text-sm text-muted-foreground">{labels.description}</p>
          </div>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <TableSearch
              value={search}
              onValueChange={onSearchChange}
              label={labels.search}
              placeholder={labels.searchPlaceholder}
              clearLabel={labels.clearSearch}
            />
            {toolbar}
            <CustomerLink href={createHref} className={primaryButtonClass}>
              <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.create}
            </CustomerLink>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className={tableClass} aria-busy={loading}>
            {loading && customers.length > 0 && (
              <caption className="sr-only">
                <output>{labels.loading}</output>
              </caption>
            )}
            <thead>
              <tr className={tableRowClass}>
                {[
                  labels.customer,
                  labels.email,
                  ...(syncColumn ? [syncColumn.label] : []),
                  labels.actions,
                ].map((label, index) => (
                  <th
                    scope="col"
                    key={index}
                    className={
                      index === (syncColumn ? 3 : 2) ? tableActionCellClass : tableHeaderClass
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {retainRemovedItems(customers, suppliedCustomers, optimistic.pending).map(
                (customer) => (
                  <tr
                    key={customer.id}
                    hidden={!customers.some((row) => row.id === customer.id)}
                    className={tableRowClass}
                  >
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-3">
                        <CustomerAvatar customer={customer} />
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{customerDisplayName(customer)}</span>
                          {customer.companyName?.trim() && (
                            <span className="text-xs text-muted-foreground">{customer.name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-1">
                        <span>{customer.email}</span>
                        <CustomerStatusBadge
                          customer={customer}
                          labels={labels}
                          disabled={loading || optimistic.pending || !!loadError}
                          onChange={
                            onSetVerified
                              ? (verified) =>
                                  optimistic.run(
                                    (rows) =>
                                      rows.map((row) =>
                                        row.id === customer.id
                                          ? { ...row, emailVerified: verified }
                                          : row,
                                      ),
                                    () => onSetVerified(customer.id, verified),
                                  )
                              : undefined
                          }
                        />
                      </div>
                    </td>
                    {syncColumn && (
                      <td className={tableCellClass}>{syncColumn.render(customer)}</td>
                    )}
                    <td className={tableActionCellClass}>
                      <div className="flex items-start justify-end gap-1">
                        {onImpersonate && (
                          <CustomerActionButton
                            disabled={loading || optimistic.pending || !!loadError}
                            label={labels.impersonate}
                            labels={labels}
                            onAction={() => onImpersonate(customer.id)}
                          >
                            <UserRoundIcon aria-hidden="true" />
                          </CustomerActionButton>
                        )}
                        <IconTooltip label={labels.viewProjects}>
                          <CustomerLink
                            href={getCustomerHref(customer, "projects")}
                            className={iconButtonClass}
                            aria-label={labels.viewProjects}
                          >
                            <FolderKanbanIcon aria-hidden="true" />
                          </CustomerLink>
                        </IconTooltip>
                        <IconTooltip label={labels.edit}>
                          <CustomerLink
                            href={getCustomerHref(customer, "about")}
                            className={iconButtonClass}
                            aria-label={labels.edit}
                          >
                            <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                          </CustomerLink>
                        </IconTooltip>
                        {onDelete && (
                          <DeleteCustomer
                            customer={customer}
                            onDelete={(id) =>
                              optimistic.run(
                                (rows) => rows.filter((row) => row.id !== id),
                                () => onDelete(id),
                              )
                            }
                            labels={labels}
                            disabled={loading || optimistic.pending || !!loadError}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {((error && !loading) || customers.length === 0) && (
                <tr className={tableRowClass}>
                  <td
                    colSpan={syncColumn ? 4 : 3}
                    className={cn(tableCellClass, "py-10 text-center text-muted-foreground")}
                  >
                    {error && !loading ? (
                      <p role="alert" className="text-destructive">
                        {error}
                      </p>
                    ) : (
                      <output>{loading ? labels.loading : labels.empty}</output>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CustomerDetailPageContent({
  customer: suppliedCustomer,
  section = "about",
  backHref,
  sectionHrefs,
  onSave,
  onDelete,
  onSetVerified,
  emailChangeDescription,
  projectsContent,
  syncContent,
  className,
  labels: overrides,
  linkComponent: CustomerLink = Link,
}: CustomerDetailPageProps) {
  const labels = { ...customerLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedCustomer, suppliedCustomer.id);
  const customer = optimistic.value;
  return (
    <div className={cn(pageClass, className)}>
      <CustomerLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        {labels.back}
      </CustomerLink>
      <header className={cn(cardClass, "flex flex-wrap items-center gap-4")}>
        <div className="flex min-w-0 items-center gap-4">
          <CustomerAvatar customer={customer} large />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{customerDisplayName(customer)}</h1>
            <p className="truncate text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <dl className="ml-auto flex flex-wrap justify-end gap-x-6 gap-y-2 self-start text-sm">
          <div>
            <dt className="text-muted-foreground">{labels.email}</dt>
            <dd className="mt-1">
              <CustomerStatusBadge
                customer={customer}
                labels={labels}
                disabled={optimistic.pending}
                onChange={
                  onSetVerified
                    ? (verified) =>
                        optimistic.run(
                          (row) => ({ ...row, emailVerified: verified }),
                          () => onSetVerified(customer.id, verified),
                        )
                    : undefined
                }
              />
            </dd>
          </div>
          {customer.banned && (
            <div>
              <dt className="text-muted-foreground">{labels.banned}</dt>
              <dd className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-status-canceled px-2 py-0.5 text-xs font-medium text-status-canceled-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-current">
                {labels.yes}
              </dd>
            </div>
          )}
        </dl>
      </header>
      <nav aria-label={labels.sections} className="flex overflow-x-auto border-b border-border">
        {(["about", "projects", "sync"] as const).map((tab: CustomerSection) => (
          <CustomerLink
            key={tab}
            href={sectionHrefs[tab]}
            aria-current={section === tab ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              section === tab && "border-primary text-primary",
            )}
          >
            {labels[tab]}
          </CustomerLink>
        ))}
      </nav>
      {section === "about" ? (
        <>
          <CustomerForm
            key={customer.id}
            customer={customer}
            labels={labels}
            onSubmit={(values) =>
              optimistic.run(
                (row) => ({
                  ...row,
                  ...values,
                  emailVerified: row.email === values.email && row.emailVerified,
                }),
                () => onSave(values),
              )
            }
            emailChangeDescription={emailChangeDescription}
            disabled={optimistic.pending}
          />
          {onDelete && (
            <DeleteCustomer
              key={customer.id}
              customer={customer}
              labels={labels}
              disabled={optimistic.pending}
              onDelete={(id) =>
                optimistic.run(
                  (row) => row,
                  () => onDelete(id),
                )
              }
            />
          )}
        </>
      ) : section === "projects" ? (
        projectsContent
      ) : (
        syncContent
      )}
    </div>
  );
}

export function CustomerNewPage({
  backHref,
  onCreate,
  passwordMinLength,
  passwordMaxLength,
  className,
  labels: overrides,
  linkComponent: CustomerLink = Link,
}: CustomerNewPageProps) {
  const labels = { ...customerLabels, ...overrides };
  return (
    <div className={cn(pageClass, className)}>
      <CustomerLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        {labels.back}
      </CustomerLink>
      <header className={cn(cardClass, "space-y-1.5")}>
        <h1 className="text-base font-semibold">{labels.newTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.newDescription}</p>
      </header>
      <CustomerForm
        labels={labels}
        onSubmit={onCreate}
        passwordMinLength={passwordMinLength}
        passwordMaxLength={passwordMaxLength}
      />
    </div>
  );
}

export function CustomersPage(props: CustomersPageProps) {
  return (
    <ActionToastProvider>
      <CustomersPageContent {...props} />
    </ActionToastProvider>
  );
}

export function CustomerDetailPage(props: CustomerDetailPageProps) {
  return (
    <ActionToastProvider>
      <CustomerDetailPageContent key={props.customer.id} {...props} />
    </ActionToastProvider>
  );
}
