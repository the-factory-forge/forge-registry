"use client";

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  CustomersPage,
  CustomerDetailPage,
  CustomerNewPage,
  type CustomerFormValues,
} from "@/components/plugins/customers";
import { usePluginsPreview } from "@/showroom/plugins-preview";
import { CustomerProjectsPreview } from "@/showroom/projects-preview";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";

export function CustomersPreview() {
  const state = usePluginsPreview();
  const params = useShowroomParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const base = `/${params.locale}/customers`;
  const [customerId, tab] = params.segments ?? [];
  const { customers, setCustomers, beforeAction } = state;
  const onDelete = state.showActions
    ? async (id: string) => {
        await beforeAction();
        if (state.projects.some((project) => project.ownerId === id)) {
          state.setNotice(
            "Reassign or delete this customer's projects before deleting the customer.",
          );
          throw new Error("Customer owns projects");
        }
        setCustomers((current) => current.filter((customer) => customer.id !== id));
        state.setNotice("Customer deleted successfully.");
        if (customerId) await navigate({ href: base });
      }
    : undefined;

  if (customerId === "new")
    return (
      <CustomerNewPage
        className="showroom-page"
        linkComponent={Link}
        backHref={base}
        onCreate={async (values) => {
          await beforeAction();
          // Only contact fields enter showroom state. Credentials are never retained.
          const { password: _password, ...fields } = values;
          const id = crypto.randomUUID();
          setCustomers((current) => [...current, { ...fields, id, emailVerified: false }]);
          state.setNotice("Customer created successfully.");
          await navigate({ href: `${base}/${id}` });
        }}
      />
    );

  if (customerId) {
    const customer = customers.find((entry) => entry.id === customerId);
    if (
      !customer ||
      (tab && tab !== "projects" && tab !== "sync") ||
      (params.segments?.length ?? 0) > 2
    )
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Customer page not found</h1>
          <Link href={base} className="underline">
            Back to Customers
          </Link>
        </div>
      );
    return (
      <CustomerDetailPage
        className="showroom-page"
        customer={customer}
        section={tab === "projects" || tab === "sync" ? tab : "about"}
        backHref={base}
        sectionHrefs={{
          about: `${base}/${customerId}`,
          projects: `${base}/${customerId}/projects`,
          sync: `${base}/${customerId}/sync`,
        }}
        linkComponent={Link}
        onDelete={onDelete}
        onSave={async (values: CustomerFormValues) => {
          await beforeAction();
          setCustomers((current) =>
            current.map((entry) => (entry.id === customerId ? { ...entry, ...values } : entry)),
          );
        }}
        projectsContent={
          state.showProjects ? (
            <CustomerProjectsPreview customerId={customerId} />
          ) : state.showIntegration ? (
            <p>Host projects content</p>
          ) : undefined
        }
        syncContent={state.showIntegration ? <p>Host sync content</p> : undefined}
      />
    );
  }

  const query = search.trim().toLowerCase();
  return (
    <CustomersPage
      className="showroom-page"
      customers={customers.filter((customer) =>
        [customer.name, customer.companyName, customer.email].some((value) =>
          value?.toLowerCase().includes(query),
        ),
      )}
      search={search}
      onSearchChange={setSearch}
      loading={state.directoryState === "loading"}
      error={state.directoryState === "error" ? "Unable to load customers. Try again." : undefined}
      createHref={`${base}/new`}
      getCustomerHref={(customer, section) =>
        `${base}/${customer.id}${section === "about" ? "" : `/${section}`}`
      }
      linkComponent={Link}
      onDelete={onDelete}
      onSetVerified={
        state.showActions
          ? async (id, verified) => {
              await beforeAction();
              setCustomers((current) =>
                current.map((customer) =>
                  customer.id === id ? { ...customer, emailVerified: verified } : customer,
                ),
              );
            }
          : undefined
      }
      onImpersonate={
        state.showActions
          ? async (id) => {
              await beforeAction();
              state.setNotice(
                `Impersonation callback received for ${customers.find((customer) => customer.id === id)?.name}. No session was changed.`,
              );
            }
          : undefined
      }
      syncColumn={
        state.showIntegration ? { label: "Host sync", render: () => "Not connected" } : undefined
      }
      toolbar={
        state.showIntegration ? (
          <span className="text-sm text-muted-foreground">Host toolbar</span>
        ) : undefined
      }
    />
  );
}
