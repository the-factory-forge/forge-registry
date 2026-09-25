# Intranet sidebar

The `intranet-sidebar` registry item extracts the sidenav used by
`tc-website`: customer identity at the top, grouped and nested navigation in a
scrollable middle section, and the signed-in user's profile at the bottom.
The website supplies its branding, allowed destinations, and Better Auth actions.

For a complete internal website layout, use [IntranetShell](./intranet.md).
It composes this sidebar with optional banner, topbar, and controls.

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
pnpm dlx shadcn@4.19.1 add @forge/intranet-sidebar
```

Files install under `src/components/`, `src/components/layouts/`, or
`src/components/utils/` according to their role with default aliases. The CLI adapts configured aliases. The item includes `cn`, `ui-shims`,
`auth`, Base UI, and Lucide dependencies. It does not require the showroom's custom
CSS utilities, brand assets, or a configured Better Auth client inside the registry.

The host theme must expose the standard shadcn `sidebar`, `sidebar-foreground`,
`sidebar-primary`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`,
and `sidebar-ring` tokens. The profile menu uses `popover` and
`popover-foreground`; the page inset uses `background`. These names match
`forge-template` and `tc-website`, so each website controls the colors through
its existing theme.

`tc-website` consumes the same generated files and defines its integration in
`src/components/app-sidebar.tsx` and `src/components/authenticated-shell.tsx`.
Its update command is:

```bash
pnpm registry:sidebar
pnpm format && pnpm lint:fix
pnpm lint
```

That command uses the pinned CLI with `shadcn add @forge/intranet-sidebar --yes --overwrite`
for this item and its dependencies.
Keep custom branding, routing, navigation, and auth code outside registry-managed
component paths. Fix shared behavior in this repository, run
`pnpm format && pnpm lint:fix`, then regenerate with `pnpm registry:sync`, publish
the change, and update and redeploy consumers.
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
pnpm exec shadcn add @forge/intranet-sidebar --yes --overwrite
```

The official build is identical for local and published installs. Restore the
published namespace URL before committing the consumer's `components.json`.

## Minimal layout without a navbar

Use a client component when integrating into an RSC application:

```tsx
"use client";

import type { ReactNode } from "react";
import {
  IntranetSidebar,
  IntranetSidebarInset,
  IntranetSidebarProvider,
  type IntranetSidebarProps,
} from "@/components/intranet-sidebar";

export function AdminLayout({
  children,
  user,
  pathname,
  onSignOut,
}: {
  children: ReactNode;
  user: IntranetSidebarProps["user"];
  pathname: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <IntranetSidebarProvider>
      <IntranetSidebar
        brand={{ name: "Customer name", href: "/" }}
        user={user}
        pathname={pathname}
        profileHref="/account"
        onSignOut={onSignOut}
        groups={[
          {
            id: "workspace",
            label: "Workspace",
            items: [
              { id: "projects", label: "Projects", href: "/projects" },
              {
                id: "reports",
                label: "Reports",
                items: [{ id: "monthly", label: "Monthly", href: "/reports/monthly" }],
              },
            ],
          },
        ]}
      />
      <IntranetSidebarInset>{children}</IntranetSidebarInset>
    </IntranetSidebarProvider>
  );
}
```

The built-in toggle remains available when the sidebar is hidden. Desktop uses
an offcanvas sidebar; screens below 768px use a modal drawer with focus trapping,
Escape dismissal, and focus restoration. Ordinary navigation closes the mobile
drawer. Ctrl/Cmd+B toggles navigation except while typing in editable controls.
The provider supports `defaultOpen` or controlled `open`/`onOpenChange` for desktop;
mobile visibility is independent.

When the host has a persistent header above the layout, set the inherited CSS
variable `--intranet-top-offset` on a wrapper (for example,
`className="[--intranet-top-offset:3.5rem]"`). It defaults to `0rem` and adjusts
the desktop sidebar, fixed toggle, and layout's minimum height together. The
mobile modal still covers the viewport. A custom sticky topbar should use the
same offset. Reset it to `0rem` when printing if that header is hidden.

## Inputs and integration points

| Input                | Contract                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `brand`              | Required `name` and `href`; optional `logo` React node owned by the site                               |
| `groups`             | Groups with stable IDs, optional headings, and navigation items; filter permissions in the host        |
| Navigation item      | Stable `id`, `label`, optional icon node, and `href`, nested `items`, or both                          |
| `exact`              | Match a link only at its exact pathname; otherwise child path segments also activate it                |
| `collapsible: false` | Display nested items under a static label or parent link, useful for policy subgroups                  |
| Group `footer`       | Optional site-owned actions, such as an impersonation dialog                                           |
| `user`               | Better Auth-compatible `name`, `email`, and optional `image`; failed/missing images use initials       |
| `profileHref`        | Required profile destination; the profile menu is always present                                       |
| `onSignOut`          | Async host action; must reject on failure, including Better Auth's returned `error`                    |
| `linkComponent`      | Optional router adapter accepting anchor props, `href`, children, and ref                              |
| `version`            | Optional display text, for example `v1.2.3`                                                            |
| `labels`             | Override navigation/toggle/close, profile/user-menu, sign-out/pending/error and expand/collapse labels |
| `togglePlacement`    | `sidebar` by default; `external` requires a shared toggle elsewhere in the provider                    |

A linked parent (`href` plus `items`) renders a destination link and a separate
expand/collapse button. Its section stays active on its own route or any active
child, while `aria-current="page"` on the parent identifies only its exact
route. An empty child list still renders the parent link, which supports
asynchronously loaded project navigation. Empty groups without a link are hidden.

### Sidebar logo

Pass a compact symbol-only mark to `brand.logo`, not the full wordmark: the sidebar
already renders `brand.name` beside it. The shared component reserves a 28 × 28 px
box and fits images without stretching. The mark is decorative; the visible site
name labels the link.

Consumer projects expose `SITE_LOGO_MARK` from `src/lib/site/constants.ts` for this
compact asset and keep `SITE_LOGO` for their full logo. Reuse an existing icon-only
asset where available; otherwise create a simplified mark in that site's assets.
Do not replace a customer's identity with another project's logo.

```tsx
brand={{
  name: SITE_NAME,
  href: "/",
  logo: <img src={SITE_LOGO_MARK} alt="" width={28} height={28} />,
}}
```

Update sizing and other shared logo behavior here first, regenerate the registry,
then propagate it to consumers while preserving their brand assets and adapters.

`IntranetSidebarInset` renders a `main` by default. Pass `as="div"` when the
host's route content already supplies its own `main` landmark.

For a custom navbar, set `togglePlacement="external"` and render
`<IntranetSidebarToggle />` in that navbar, inside the same provider. Its
`aria-label`, classes, and icon children can be customized. `tc-website` uses this
arrangement; the navbar itself remains site-owned.

For TanStack Router, pass a stable adapter declared outside the layout component:

```tsx
import { Link as RouterLink } from "@tanstack/react-router";
import type { IntranetLinkProps } from "@/components/intranet-sidebar";

function SidebarLink({ href, ...props }: IntranetLinkProps) {
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

Run `pnpm dev --port 3010` and open `/en/intranet-sidebar`. The showroom uses mock
profile data and hash navigation. It demonstrates a configurable customer name,
both toggle placements, nested links, and simulated sign-out success/failure.
The `/en/intranet` demo also includes linked parent navigation and a custom topbar.
Run `pnpm test` for the navigation matching regression checks (Node 22.18+).

Verify desktop collapse/reopen, keyboard focus after collapse, mobile Escape and
focus restoration, profile actions, and navigation with long labels. Follow the
[contributor validation flow](../CONTRIBUTING.md#formatting-and-validation), then
run `pnpm build` for layout or integration changes. Vite Plus reads lint/format
settings from `vite.config.ts`; regenerate excluded `public/r/` JSON after source
formatting. When changing distribution behavior, verify a shadcn consumer install.
