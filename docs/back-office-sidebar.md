# Back-office sidebar

The `back-office-sidebar` registry item extracts the sidenav used by
`tc-website`: customer identity at the top, grouped and nested navigation in a
scrollable middle section, and the signed-in user's profile at the bottom.
The website supplies its branding, allowed destinations, and Better Auth actions.

## Install and update

After these registry artifacts are published to `main`, install from a project
with shadcn configured and Tailwind CSS 4 semantic theme tokens. Add the namespace
to the project's existing `components.json`:

```json
{
  "registries": {
    "@forge": "https://raw.githubusercontent.com/the-factory-forge/forge-registry/main/public/r/{name}.json"
  }
}
```

Then install the item:

```bash
pnpm dlx shadcn@4.19.1 add @forge/back-office-sidebar
```

Files install under `src/components/forge/` and `src/lib/forge/` with default
aliases. The CLI adapts configured aliases. The item includes `cn`, `ui-shims`,
Base UI, and Lucide dependencies. It does not require the showroom's custom
CSS utilities, brand assets, or a configured Better Auth client inside the registry.

`tc-website` consumes the same generated files and defines its integration in
`src/components/app-sidebar.tsx` and `src/components/authenticated-shell.tsx`.
Its update command is:

```bash
pnpm registry:sidebar
pnpm format && pnpm lint:fix
pnpm lint
```

That command uses the pinned CLI with `shadcn add @forge/back-office-sidebar --yes --overwrite`
for this item and its dependencies.
Keep custom branding, routing, navigation, and auth code outside the generated
`forge` directories. Fix shared behavior in this repository, regenerate with
`pnpm registry:sync`, publish the change, then update and redeploy consumers.
shadcn copies source: an existing deployed website does not change automatically
when the registry changes. The namespace URL tracks `main`; consumers can replace
`main` with a GitHub commit in `components.json` to pin all `@forge` items to a revision.

For local development, temporarily change the consumer's `@forge` namespace URL
to `http://localhost:3010/r/{name}.json`, then:

```bash
# In forge-registry:
pnpm registry:sync
pnpm dev --port 3010
# In the consumer project:
pnpm exec shadcn add @forge/back-office-sidebar --yes --overwrite
```

The official build is identical for local and published installs. Restore the
published namespace URL before committing the consumer's `components.json`.

## Minimal layout without a navbar

Use a client component when integrating into an RSC application:

```tsx
"use client";

import type { ReactNode } from "react";
import {
  BackOfficeSidebar,
  BackOfficeSidebarInset,
  BackOfficeSidebarProvider,
  type BackOfficeSidebarProps,
} from "@/components/forge/navigation/back-office-sidebar";

export function AdminLayout({ children, user, pathname, onSignOut }: {
  children: ReactNode;
  user: BackOfficeSidebarProps["user"];
  pathname: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <BackOfficeSidebarProvider>
      <BackOfficeSidebar
        brand={{ name: "Customer name", href: "/" }}
        user={user}
        pathname={pathname}
        profileHref="/account"
        onSignOut={onSignOut}
        groups={[{
          id: "workspace",
          label: "Workspace",
          items: [
            { id: "projects", label: "Projects", href: "/projects" },
            { id: "reports", label: "Reports", items: [
              { id: "monthly", label: "Monthly", href: "/reports/monthly" },
            ] },
          ],
        }]}
      />
      <BackOfficeSidebarInset>{children}</BackOfficeSidebarInset>
    </BackOfficeSidebarProvider>
  );
}
```

The built-in toggle remains available when the sidebar is hidden. Desktop uses
an offcanvas sidebar; screens below 768px use a modal drawer with focus trapping,
Escape dismissal, and focus restoration. Ordinary navigation closes the mobile
drawer. Ctrl/Cmd+B toggles navigation except while typing in editable controls.
The provider supports `defaultOpen` or controlled `open`/`onOpenChange` for desktop;
mobile visibility is independent.

## Inputs and integration points

| Input | Contract |
| --- | --- |
| `brand` | Required `name` and `href`; optional `logo` React node owned by the site |
| `groups` | Groups with stable IDs, optional headings, and navigation items; filter permissions in the host |
| Navigation item | Stable `id`, `label`, optional icon node, and either `href` or nested `items` |
| `exact` | Match a link only at its exact pathname; otherwise child path segments also activate it |
| `collapsible: false` | Display nested items under a static label, useful for policy subgroups |
| Group `footer` | Optional site-owned actions, such as an impersonation dialog |
| `user` | Better Auth-compatible `name`, `email`, and optional `image`; failed/missing images use initials |
| `profileHref` | Required profile destination; the profile menu is always present |
| `onSignOut` | Async host action; must reject on failure, including Better Auth's returned `error` |
| `linkComponent` | Optional router adapter accepting anchor props, `href`, children, and ref |
| `version` | Optional display text, for example `v1.2.3` |
| `labels` | Override navigation/toggle/close, profile/user-menu, sign-out/pending/error labels |
| `togglePlacement` | `sidebar` by default; `external` requires a shared toggle elsewhere in the provider |

For a custom navbar, set `togglePlacement="external"` and render
`<BackOfficeSidebarToggle />` in that navbar, inside the same provider. Its
`aria-label`, classes, and icon children can be customized. `tc-website` uses this
arrangement; the navbar itself remains site-owned.

For TanStack Router, pass a stable adapter declared outside the layout component:

```tsx
import { Link as RouterLink } from "@tanstack/react-router";
import type { BackOfficeLinkProps } from "@/components/forge/navigation/back-office-sidebar";

function SidebarLink({ href, ...props }: BackOfficeLinkProps) {
  return <RouterLink to={href} {...props} />;
}
// Pass linkComponent={SidebarLink} and the router's current pathname.
```

Keep Better Auth configuration, session fetching, route guards, and permissions
in the website. A host sign-out callback calls `authClient.signOut()`, checks
`result.error` and throws if present, then clears cached auth data and invalidates
the router or redirects. The sidebar prevents duplicate submissions, announces
pending state, and displays a retryable error. It does not grant access based on
navigation visibility; existing server authorization remains authoritative.

## Preview and verification

Run `pnpm dev --port 3010` and open `/en/back-office`. The showroom uses mock
profile data and hash navigation. It demonstrates a configurable customer name,
both toggle placements, nested links, and simulated sign-out success/failure.

Verify desktop collapse/reopen, keyboard focus after collapse, mobile Escape and
focus restoration, profile actions, and navigation with long labels. Run
`pnpm registry:sync`, `pnpm registry:check`, `pnpm typecheck`, `pnpm lint`, and
`pnpm build`. When changing distribution behavior, verify a shadcn consumer install.
