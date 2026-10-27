import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { CustomersPage, type Customer } from "@/components/plugins/customers";
import { CustomerForm } from "@/components/plugins/customers/customer-form";
import { customerLabels } from "@/components/plugins/customers/labels";
import { ProjectsList, type Project } from "@/components/plugins/projects";
import { projectLabels } from "@/components/plugins/projects/labels";
import { ProjectForm } from "@/components/plugins/projects/project-form";

import "../../src/styles/globals.css";

const initial = [
  {
    id: "alpha",
    name: "Alpha",
    email: "alpha@example.test",
    emailVerified: false,
    ownerId: "owner",
    status: "requested" as const,
  },
  {
    id: "beta",
    name: "Beta",
    email: "beta@example.test",
    emailVerified: false,
    ownerId: "owner",
    status: "requested" as const,
  },
];
const calls: string[] = [];
let resolveRequest: () => void;
let rejectRequest: () => void;
const onDelete = (id: string) => {
  calls.push(id);
  return new Promise<void>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = () => reject(new Error("Rejected deletion"));
  });
};
declare global {
  interface Window {
    deletionTest: {
      calls: string[];
      rename: (id: string, name: string) => void;
      remove: (id: string) => void;
      changeView: () => void;
      revoke: () => void;
      resolve: () => void;
      reject: () => void;
    };
  }
}
const kind = new URLSearchParams(location.search).get("kind") ?? "customers";

function Fixture() {
  const [items, setItems] = useState<(Customer & Project)[]>(initial);
  const [search, setSearch] = useState("");
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    window.deletionTest = {
      calls,
      rename: (id, name) =>
        setItems((rows) => rows.map((row) => (row.id === id ? { ...row, name } : row))),
      remove: (id) => setItems((rows) => rows.filter((row) => row.id !== id)),
      changeView: () => setSearch("another view"),
      revoke: () => setAllowed(false),
      resolve: () => resolveRequest(),
      reject: () => rejectRequest(),
    };
  }, []);
  const deletion = allowed ? onDelete : undefined;
  return (
    <main>
      {kind === "customers" ? (
        <CustomersPage
          customers={items}
          search={search}
          onSearchChange={setSearch}
          createHref="#"
          getCustomerHref={() => "#"}
          onDelete={deletion}
        />
      ) : kind === "projects" ? (
        <ProjectsList
          projects={items}
          customers={[]}
          search={search}
          onSearchChange={setSearch}
          getProjectHref={() => "#"}
          onDelete={deletion}
        />
      ) : kind === "customer-form" ? (
        <CustomerForm
          customer={items[0]}
          labels={customerLabels}
          onSubmit={async () => {}}
          onDelete={deletion}
        />
      ) : (
        <ProjectForm
          project={items[0]}
          labels={projectLabels}
          onSubmit={async () => {}}
          onDelete={deletion}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("factory-deletion-fixture")!).render(<Fixture />);
