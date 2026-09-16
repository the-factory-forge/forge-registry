# Intranet layout

`intranet-shell` is the layout for an internal website: customer branding,
configurable navigation, a user profile, and a content area with optional banner,
topbar, and controls. It composes `intranet-sidebar` so both
layouts share navigation, toggle, mobile drawer, and profile behavior.

Use **intranet** for the complete internal website. See the
[sidebar guide](./intranet-sidebar.md) for its full navigation, router, and
Better Auth contracts.

## Install

Configure the `@forge` namespace in the consumer's `components.json` as described
in [README](../README.md#installing-from-the-registry), then install:

```bash
pnpm dlx shadcn@4.19.1 add @forge/intranet-shell
```

With default aliases, the shell installs to
`src/components/layouts/intranet-shell.tsx`. Its registry dependencies
include the shared sidebar and utilities. It uses the consumer's Tailwind CSS 4
semantic tokens. The host supplies its branding and any site-specific styling.

## Usage

The host provides the current pathname, allowed navigation items, user data,
and a sign-out callback. In an RSC application, use a client component for this
integration:

```tsx
"use client";

import type { ReactNode } from "react";
import { IntranetShell, type IntranetShellProps } from "@/components/layouts/intranet-shell";

export function IntranetLayout({
  user,
  pathname,
  onSignOut,
  children,
}: Pick<IntranetShellProps, "user" | "pathname" | "onSignOut"> & {
  children: ReactNode;
}) {
  return (
    <IntranetShell
      brand={{ name: "Customer name", href: "/intranet" }}
      user={user}
      pathname={pathname}
      profileHref="/account"
      onSignOut={onSignOut}
      groups={[
        {
          id: "workspace",
          label: "Workspace",
          items: [
            { id: "overview", label: "Overview", href: "/intranet", exact: true },
            { id: "projects", label: "Projects", href: "/intranet/projects" },
          ],
        },
      ]}
      topbar={<span>Workspace</span>}
      controls={<a href="/help">Help</a>}
    >
      {children}
    </IntranetShell>
  );
}
```

Session fetching, Better Auth configuration, authorization, permission filtering,
and router invalidation remain in the host. The sign-out callback must reject on
failure, including Better Auth's returned `error`, so the shared profile menu can
show its retryable error state. `user` accepts `name`, `email`, and optional
`image`. Pass `linkComponent` for a router adapter as documented in the sidebar
guide.

## Layout inputs

`IntranetShellProps` accepts the sidebar's inputs except `togglePlacement` and
its sidebar `className`. It adds these layout inputs:

| Input              | Behavior                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `banner`           | Complete banner above the topbar; the host supplies its colors and spacing. Hidden when printing.               |
| `topbar`           | Content inside the default topbar; defaults to the customer name                                                |
| `renderTopbar`     | Render a complete custom navbar with the supplied toggle; replaces the default topbar and its controls          |
| `controls`         | Optional actions at the end of the topbar                                                                       |
| `showTopbar`       | Defaults to `true`; `false` hides the topbar and its controls and keeps the sidebar's built-in toggle available |
| `children`         | Main page content                                                                                               |
| `className`        | Classes for the main inset beside the sidebar                                                                   |
| `contentClassName` | Classes for the padded content wrapper, which has `data-slot="intranet-content"`                                |
| `sidebarClassName` | Classes forwarded to the sidebar, including host navigation styling                                             |
| `insetAs`          | `main` by default; use `div` when route content owns the main landmark                                          |
| `wrapContent`      | `true` by default; use `false` to preserve the host page wrapper and direct-child print selectors               |

The shell manages its provider and toggle placement. On desktop, navigation
collapses offcanvas; on mobile, it uses the shared modal drawer. The profile
remains part of the sidebar in either configuration. For more control over the
provider, toggle placement, or a custom navbar structure, compose the
[sidebar exports](./intranet-sidebar.md#minimal-layout-without-a-navbar)
directly.

## TC integration

TC already uses the shared sidebar primitives. Its `AppSidebar` owns the router
adapter, permission-filtered navigation, customer project queries, branding, and
Better Auth callbacks. Keep those in TC. To adopt `IntranetShell`, expose that
existing setup through a host-owned `useAppSidebarProps` hook and pass the result
to the shell:

```tsx
const { className: sidebarClassName, ...sidebarProps } = useAppSidebarProps({ profile, user });

return (
  <IntranetShell
    {...sidebarProps}
    sidebarClassName={sidebarClassName}
    insetAs="div"
    wrapContent={false}
    banner={<ImpersonationBanner user={user} />}
    renderTopbar={(toggle) => (
      <StickyThemeNav className="print:hidden" leftAction={toggle} rightAction={<LogoutButton />} />
    )}
  >
    {children}
  </IntranetShell>
);
```

This is an integration example; the registry does not install the TC adapters.
The hook should omit `togglePlacement`, which the shell manages. Existing
`AppSidebar` callers can continue rendering `IntranetSidebar` with the same hook.
`renderTopbar` must place the supplied toggle; mark the custom navbar
`print:hidden` as TC already does. `showTopbar={false}` hides either topbar and
restores the built-in sidebar toggle.

With `wrapContent={false}`, route content remains a direct child of
`[data-slot="sidebar-inset"]`, preserving TC's print selectors. Default wrapped
content removes its padding when printing. Banner slots now own their visual
styling: move any desired border/padding into the banner itself.

## Preview and update

Run `pnpm dev --port 3010` and open `/en/intranet`. The showroom uses mock user
and navigation data, a banner control, and a topbar toggle.
`/en/intranet-sidebar` provides focused sidebar behavior checks.

Use the [local registry workflow](../README.md#installing-from-the-registry) to
test changes in a consumer. Publish generated artifacts before updating from the
`main` namespace. Keep host adapters outside registry-managed component paths;
review changes when rerunning shadcn with `--overwrite`, then validate and deploy
the consumer. Installing this item does not migrate an existing host layout
automatically.
