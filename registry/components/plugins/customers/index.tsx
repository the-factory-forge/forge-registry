"use client";

import { Input } from "@base-ui/react/input";
import {
  ArrowLeftIcon,
  FolderKanbanIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserRoundIcon,
} from "lucide-react";

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
  DeleteCustomer,
  inputClass,
  primaryButtonClass,
} from "@/components/plugins/customers/ui";
import { customerDisplayName } from "@/components/plugins/customers/utils";
import { cn } from "@/components/utils/cn";

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

export function CustomersPage({
  customers,
  search,
  onSearchChange,
  loading = false,
  error,
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
  return (
    <div className={cn(pageClass, className)}>
      <section className={cn(cardClass, "space-y-5")} aria-label={labels.title}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-base font-semibold">{labels.title}</h1>
            <p className="text-sm text-muted-foreground">{labels.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            <CustomerLink href={createHref} className={primaryButtonClass}>
              <PlusIcon aria-hidden="true" />
              {labels.create}
            </CustomerLink>
          </div>
        </header>
        <div className="relative max-w-sm">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={labels.search}
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className={cn(inputClass, "pl-9")}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : loading ? (
          <output className="block py-10 text-center text-sm text-muted-foreground">
            {labels.loading}
          </output>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    labels.customer,
                    labels.email,
                    ...(syncColumn ? [syncColumn.label] : []),
                    labels.actions,
                  ].map((label, index) => (
                    <th
                      scope="col"
                      key={index}
                      className="px-3 py-3 font-medium text-muted-foreground last:text-right"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3">
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
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <span>{customer.email}</span>
                        {onSetVerified ? (
                          <CustomerActionButton
                            label={customer.emailVerified ? labels.unverify : labels.verify}
                            labels={labels}
                            onAction={() => onSetVerified(customer.id, !customer.emailVerified)}
                          >
                            {customer.emailVerified ? (
                              <ShieldOffIcon aria-hidden="true" />
                            ) : (
                              <ShieldCheckIcon aria-hidden="true" />
                            )}
                          </CustomerActionButton>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {customer.emailVerified ? labels.verified : labels.unverified}
                          </span>
                        )}
                      </div>
                    </td>
                    {syncColumn && <td className="px-3 py-3">{syncColumn.render(customer)}</td>}
                    <td className="px-3 py-3">
                      <div className="flex items-start justify-end gap-1">
                        {onImpersonate && (
                          <CustomerActionButton
                            label={labels.impersonate}
                            labels={labels}
                            onAction={() => onImpersonate(customer.id)}
                          >
                            <UserRoundIcon aria-hidden="true" />
                          </CustomerActionButton>
                        )}
                        <CustomerLink
                          href={getCustomerHref(customer, "projects")}
                          className={buttonClass}
                          aria-label={labels.viewProjects}
                        >
                          <FolderKanbanIcon aria-hidden="true" />
                        </CustomerLink>
                        <CustomerLink
                          href={getCustomerHref(customer, "about")}
                          className={buttonClass}
                          aria-label={labels.edit}
                        >
                          <PencilIcon aria-hidden="true" />
                        </CustomerLink>
                        {onDelete && (
                          <DeleteCustomer customer={customer} onDelete={onDelete} labels={labels} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td
                      colSpan={syncColumn ? 4 : 3}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {labels.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function CustomerDetailPage({
  customer,
  section = "about",
  backHref,
  sectionHrefs,
  onSave,
  onDelete,
  emailChangeDescription,
  projectsContent,
  syncContent,
  className,
  labels: overrides,
  linkComponent: CustomerLink = Link,
}: CustomerDetailPageProps) {
  const labels = { ...customerLabels, ...overrides };
  return (
    <div className={cn(pageClass, className)}>
      <CustomerLink href={backHref} className={buttonClass}>
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
        <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{labels.email}</dt>
            <dd className="font-medium">
              {customer.emailVerified ? labels.verified : labels.unverified}
            </dd>
          </div>
          {customer.banned && (
            <div>
              <dt className="text-muted-foreground">{labels.banned}</dt>
              <dd className="font-medium text-red-600 dark:text-red-400">{labels.yes}</dd>
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
            onSubmit={onSave}
            emailChangeDescription={emailChangeDescription}
          />
          {onDelete && (
            <DeleteCustomer
              key={customer.id}
              customer={customer}
              labels={labels}
              onDelete={onDelete}
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
      <CustomerLink href={backHref} className={buttonClass}>
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
