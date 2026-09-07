"use client";

import { FileTextIcon, HomeIcon, UsersIcon, UserRoundIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { IntranetShell } from "@/components/forge/intranet/intranet-shell";
import type { IntranetNavGroup } from "@/components/forge/navigation/intranet-sidebar";

const groups: IntranetNavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", href: "#overview", icon: <HomeIcon /> },
      { id: "team", label: "Team", href: "#team", icon: <UsersIcon /> },
      {
        id: "documents",
        label: "Documents",
        icon: <FileTextIcon />,
        items: [
          { id: "handbook", label: "Handbook", href: "#documents/handbook" },
          { id: "policies", label: "Policies", href: "#documents/policies" },
        ],
      },
    ],
  },
  {
    id: "account",
    label: "My account",
    items: [
      { id: "profile", label: "Profile settings", href: "#profile", icon: <UserRoundIcon /> },
    ],
  },
];

function subscribePath(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export default function IntranetExample() {
  const pathname = useSyncExternalStore(
    subscribePath,
    () => window.location.hash || "#overview",
    () => "#overview",
  );
  const [showTopbar, setShowTopbar] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  return (
    <IntranetShell
      brand={{ name: "Acme workspace", href: "#overview" }}
      user={{ name: "Alex Morgan", email: "alex@example.com" }}
      groups={groups}
      pathname={pathname}
      profileHref="#profile"
      version="v1.0.0"
      showTopbar={showTopbar}
      topbar={<span className="text-sm font-medium">Team workspace</span>}
      controls={<span className="text-xs text-muted-foreground">Demo account</span>}
      banner={showBanner && <p className="text-sm">Welcome to your team&apos;s intranet.</p>}
      onSignOut={() => {
        setSignedOut(true);
        return Promise.resolve();
      }}
      contentClassName="mx-auto w-full max-w-4xl space-y-6 py-10 sm:py-12"
    >
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Registry preview
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Intranet shell</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A shared workspace layout with customer branding, navigation, a user profile, and room for
          your own page content.
        </p>
      </div>
      <section
        aria-labelledby="layout-options"
        className="space-y-4 rounded-xl border border-border p-5"
      >
        <h2 id="layout-options" className="font-semibold">
          Layout options
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showTopbar}
            onChange={(event) => setShowTopbar(event.target.checked)}
          />
          Show the topbar
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBanner}
            onChange={(event) => setShowBanner(event.target.checked)}
          />
          Show the announcement banner
        </label>
        <p className="text-sm text-muted-foreground">
          Current destination: <code>{pathname}</code>
        </p>
        {signedOut && <output className="block text-sm">The demo session has ended.</output>}
      </section>
      <p className="text-sm text-muted-foreground">
        The navigation toggle stays available when you hide the topbar. Use Ctrl/Cmd+B or try the
        layout on a smaller screen to open the mobile drawer.
      </p>
    </IntranetShell>
  );
}
