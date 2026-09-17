"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Customer } from "@/components/plugins/customers";
import type { DriveSpace } from "@/components/plugins/drive";
import type { Project } from "@/components/plugins/projects";
import { createDriveMock } from "@/showroom/drive-mock";

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
  const { locale } = useParams<{ locale: string }>();
  const [driveMock] = useState(createDriveMock);
  const [showDrive, setShowDrive] = useState(true);
  const [customers, setCustomers] = useState(initialCustomers);
  const [projects, setProjects] = useState<Project[]>([
    {
      id: "website",
      name: "Studio website",
      ownerId: "acme",
      status: "requested",
      description: "A new website for Acme Studio.",
      url: "https://example.com",
      assigneeId: "jordan",
    },
    {
      id: "portal",
      name: "Customer portal",
      ownerId: "acme",
      status: "production",
      url: "/en/customers",
    },
  ]);
  const [showProjects, setShowProjects] = useState(false);
  const [peopleState, setPeopleState] = useState("ready");
  const [failActions, setFailActions] = useState(false);
  const [showActions, setShowActions] = useState(true);
  const [showIntegration, setShowIntegration] = useState(false);
  const [directoryState, setDirectoryState] = useState("ready");
  const [notice, setNotice] = useState("");
  const driveClient = useMemo(() => {
    const writable = {
      upload: true,
      createFolder: true,
      rename: true,
      delete: true,
      download: true,
    };
    const readOnly = {
      upload: false,
      createFolder: false,
      rename: false,
      delete: false,
      download: true,
    };
    const spaces: DriveSpace[] = [
      ...projects.map((project) => {
        const customer = customers.find((customer) => customer.id === project.ownerId);
        return {
          scope: { type: "project", id: project.id },
          name: project.name,
          href: `/${locale}/projects/${project.id}`,
          owner: customer
            ? { name: customer.companyName || customer.name, image: customer.image }
            : undefined,
          capabilities: writable,
        };
      }),
      {
        scope: { type: "workspace", id: "handbook" },
        name: "Team handbook",
        capabilities: readOnly,
      },
    ];
    return driveMock.client(spaces, failActions, directoryState);
  }, [projects, customers, locale, driveMock, failActions, directoryState]);
  async function beforeAction() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (failActions) throw new Error("Simulated host failure");
  }
  return {
    driveMock,
    driveClient,
    showDrive,
    setShowDrive,
    projects,
    setProjects,
    showProjects,
    setShowProjects,
    peopleState,
    setPeopleState,
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

export function usePluginsPreview() {
  const state = useContext(PreviewContext);
  if (!state) throw new Error("Missing plugins preview provider");
  return state;
}

export const previewAssignees = [
  { id: "jordan", name: "Jordan Lee", email: "jordan@example.com" },
  { id: "taylor", name: "Taylor Casey", email: "taylor@example.com" },
];

export function PluginsPreviewProvider({ children }: { children: ReactNode }) {
  const state = usePreviewState();
  const { locale } = useParams<{ locale: string }>();
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
          <Link href={`/${locale}/customers`} className="underline">
            Customer directory
          </Link>
          <Link href={`/${locale}/projects`} className="underline">
            Project directory
          </Link>
          <Link href={`/${locale}/drive`} className="underline">
            Drive directory
          </Link>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showDrive}
              onChange={(event) => state.setShowDrive(event.target.checked)}
            />
            Drive integration
          </label>
          <button
            type="button"
            className="underline"
            onClick={() => {
              state.driveMock.failUpload();
              state.setNotice("The next upload will fail once; retry will succeed.");
            }}
          >
            Fail next upload
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => {
              state.driveMock.failDeletion();
              state.setNotice("The next deletion will pause; retry will finish it.");
            }}
          >
            Interrupt next deletion
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.showProjects}
              onChange={(event) => state.setShowProjects(event.target.checked)}
            />
            Projects integration
          </label>
          <label>
            People directories{" "}
            <select
              aria-label="People directories"
              value={state.peopleState}
              onChange={(event) => state.setPeopleState(event.target.value)}
              className="rounded border border-border bg-background p-1"
            >
              <option value="ready">Ready</option>
              <option value="loading">Loading</option>
              <option value="error">Error</option>
              <option value="empty">No customers</option>
              <option value="unavailable">Current owner unavailable</option>
            </select>
          </label>
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
