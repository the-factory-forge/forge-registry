"use client";

import {
  FileTextIcon,
  FolderKanbanIcon,
  GoalIcon,
  NetworkIcon,
  ReceiptIcon,
  SettingsIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
  IntranetSidebar,
  IntranetSidebarInset,
  IntranetSidebarProvider,
  IntranetSidebarToggle,
  type IntranetNavGroup,
} from "@/components/forge/navigation/intranet-sidebar";

const groups: IntranetNavGroup[] = [
  {
    id: "my-space",
    label: "My space",
    items: [
      {
        id: "profile",
        label: "Profile settings",
        icon: <UserRoundIcon />,
        href: "#profile",
        exact: true,
      },
      { id: "objectives", label: "Objectives", icon: <GoalIcon />, href: "#objectives" },
      {
        id: "contracts",
        label: "Contracts",
        icon: <FileTextIcon />,
        items: [
          { id: "customer-contract", label: "Customer", href: "#contracts/customer" },
          { id: "employment", label: "Employment", href: "#contracts/employment" },
          {
            id: "policies",
            label: "Policies",
            collapsible: false,
            items: [
              {
                id: "confidentiality",
                label: "Confidentiality",
                href: "#policies/confidentiality",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { id: "customers", label: "Customers", icon: <UserRoundIcon />, href: "#customers" },
      { id: "projects", label: "Projects", icon: <FolderKanbanIcon />, href: "#projects" },
      { id: "invoices", label: "Invoices", icon: <ReceiptIcon />, href: "#invoices" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    items: [
      { id: "tools", label: "Tools", icon: <SettingsIcon />, href: "#tools" },
      {
        id: "rates",
        label: "Rates",
        icon: <TrendingUpIcon />,
        items: [
          { id: "designers", label: "Designers", href: "#rates/designers" },
          { id: "developers", label: "Developers", href: "#rates/developers" },
        ],
      },
    ],
  },
  {
    id: "hr",
    label: "Human Resources",
    items: [
      {
        id: "organization",
        label: "Organizational Charts",
        icon: <NetworkIcon />,
        href: "#organization",
      },
      { id: "employees", label: "Employees", icon: <UsersIcon />, href: "#employees" },
    ],
  },
];

function subscribePath(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export default function IntranetSidebarExample() {
  const pathname = useSyncExternalStore(
    subscribePath,
    () => window.location.hash || "#profile",
    () => "#profile",
  );
  const [externalToggle, setExternalToggle] = useState(false);
  const [failSignOut, setFailSignOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [name, setName] = useState("The Corner");

  return (
    <IntranetSidebarProvider>
      <IntranetSidebar
        brand={{
          name,
          href: "#profile",
          logo: (
            <span className="flex size-7 items-center justify-center bg-foreground font-bold text-background">
              A
            </span>
          ),
        }}
        user={{ name: "Alex Morgan", email: "alex@example.com" }}
        groups={groups}
        pathname={pathname}
        profileHref="#profile"
        version="v1.0.0"
        togglePlacement={externalToggle ? "external" : "sidebar"}
        onSignOut={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (failSignOut) throw new Error("Demo failure");
          setSignedOut(true);
        }}
      />
      <IntranetSidebarInset>
        {externalToggle && (
          <header className="flex h-12 items-center gap-3 border-b border-border px-4">
            <IntranetSidebarToggle />
            <span className="text-sm font-medium">Example navbar</span>
          </header>
        )}
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-16 sm:px-10">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Registry preview
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Intranet sidebar</h1>
            <p className="mt-3 text-muted-foreground">
              Customer branding, nested navigation, and a user profile. The sidebar works with or
              without a navbar.
            </p>
          </div>
          <div className="space-y-4 rounded-xl border border-border p-5">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Customer name
              <input
                className="rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={externalToggle}
                onChange={(event) => setExternalToggle(event.target.checked)}
              />
              Put the toggle in a navbar
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={failSignOut}
                onChange={(event) => setFailSignOut(event.target.checked)}
              />
              Simulate a sign-out error
            </label>
            <p className="text-sm text-muted-foreground">
              Current destination: <code>{pathname}</code>
            </p>
            {signedOut && (
              <p role="status" className="text-sm">
                Demo session ended.
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Use the toggle or Ctrl/Cmd+B. On smaller screens, navigation opens in a modal drawer.
          </p>
        </div>
      </IntranetSidebarInset>
    </IntranetSidebarProvider>
  );
}
