"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  CustomersPage,
  CustomerDetailPage,
  CustomerNewPage,
  type Customer,
  type CustomerFormValues,
} from "@/components/plugins/customers";

const initialCustomers: Customer[] = [
  {
    id: "acme",
    name: "Alex Morgan",
    email: "alex@example.com",
    emailVerified: false,
    companyName: "Acme Studio",
    phoneNumber: "+41 79 123 45 67",
    street: "Rue du Rhône 10",
    city: "1204 Geneva",
    addressComplement: "Second floor",
  },
  { id: "sam", name: "Sam Rivera", email: "sam@example.com", emailVerified: true },
];

function usePreviewState() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [failActions, setFailActions] = useState(false);
  const [showActions, setShowActions] = useState(true);
  const [showIntegration, setShowIntegration] = useState(false);
  const [directoryState, setDirectoryState] = useState("ready");
  const [notice, setNotice] = useState("");
  async function beforeAction() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (failActions) throw new Error("Simulated host failure");
  }
  return {
    customers,
    setCustomers,
    failActions,
    setFailActions,
    showActions,
    setShowActions,
    showIntegration,
    setShowIntegration,
    directoryState,
    setDirectoryState,
    notice,
    setNotice,
    beforeAction,
  };
}

const PreviewContext = createContext<ReturnType<typeof usePreviewState> | null>(null);
const subscribeReady = () => () => {};

export function CustomersPreviewProvider({ children }: { children: ReactNode }) {
  const state = usePreviewState();
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  return (
    <PreviewContext.Provider value={state}>
      <main data-preview-ready={ready} className="mx-auto w-full max-w-[1536px]">
        <aside
          aria-label="Preview controls"
          className="mx-4 mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-border p-3 text-sm"
        >
          <Link href="/" className="underline">
            All components
          </Link>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.failActions}
              onChange={(event) => state.setFailActions(event.target.checked)}
            />
            Simulate action failures
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showActions}
              onChange={(event) => state.setShowActions(event.target.checked)}
            />
            Account actions
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showIntegration}
              onChange={(event) => state.setShowIntegration(event.target.checked)}
            />
            Host integration example
          </label>
          <label>
            Directory state{" "}
            <select
              value={state.directoryState}
              onChange={(event) => state.setDirectoryState(event.target.value)}
              className="rounded border border-border bg-background p-1"
            >
              <option value="ready">Ready</option>
              <option value="loading">Loading</option>
              <option value="error">Error</option>
            </select>
          </label>
          <span className="text-muted-foreground">Demo data resets on reload.</span>
        </aside>
        {state.notice && <output className="mx-4 mt-4 block text-sm">{state.notice}</output>}
        {children}
      </main>
    </PreviewContext.Provider>
  );
}

export function CustomersPreview() {
  const state = useContext(PreviewContext);
  const params = useParams<{ locale: string; segments?: string[] }>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  if (!state) throw new Error("Missing customers preview provider");
  const base = `/${params.locale}/customers`;
  const [customerId, tab] = params.segments ?? [];
  const { customers, setCustomers, beforeAction } = state;
  const onDelete = state.showActions
    ? async (id: string) => {
        await beforeAction();
        setCustomers((current) => current.filter((customer) => customer.id !== id));
        state.setNotice("Customer deleted successfully.");
        if (customerId) router.push(base);
      }
    : undefined;

  if (customerId === "new")
    return (
      <CustomerNewPage
        linkComponent={Link}
        backHref={base}
        onCreate={async (values) => {
          await beforeAction();
          // Only contact fields enter showroom state. Credentials are never retained.
          const { password: _password, ...fields } = values;
          const id = crypto.randomUUID();
          setCustomers((current) => [...current, { ...fields, id, emailVerified: false }]);
          state.setNotice("Customer created successfully.");
          router.push(`${base}/${id}`);
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
        <div className="space-y-4 p-8">
          <h1 className="text-xl font-semibold">Customer page not found</h1>
          <Link href={base} className="underline">
            Back to Customers
          </Link>
        </div>
      );
    return (
      <CustomerDetailPage
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
        projectsContent={state.showIntegration ? <p>Host projects content</p> : undefined}
        syncContent={state.showIntegration ? <p>Host sync content</p> : undefined}
      />
    );
  }

  const query = search.trim().toLowerCase();
  return (
    <CustomersPage
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
