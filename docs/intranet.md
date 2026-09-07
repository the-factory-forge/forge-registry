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
`src/components/forge/intranet/intranet-shell.tsx`. Its registry dependencies
include the shared sidebar and utilities. It uses the consumer's Tailwind CSS 4
semantic tokens and does not impose Corner branding.

## Usage

The host provides the current pathname, allowed navigation items, user data,
and a sign-out callback. In an RSC application, use a client component for this
integration:

```tsx
"use client";

import type { ReactNode } from "react";
import { IntranetShell, type IntranetShellProps } from "@/components/forge/intranet/intranet-shell";

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
| `banner`           | Optional content above the topbar, such as an impersonation notice                                              |
| `topbar`           | Optional topbar content; defaults to the customer name                                                          |
| `controls`         | Optional actions at the end of the topbar                                                                       |
| `showTopbar`       | Defaults to `true`; `false` hides the topbar and its controls and keeps the sidebar's built-in toggle available |
| `children`         | Main page content                                                                                               |
| `className`        | Classes for the main inset beside the sidebar                                                                   |
| `contentClassName` | Classes for the padded content wrapper                                                                          |

The shell manages its provider and toggle placement. On desktop, navigation
collapses offcanvas; on mobile, it uses the shared modal drawer. The profile
remains part of the sidebar in either configuration. For more control over the
provider, toggle placement, or a custom navbar structure, compose the
[sidebar exports](./intranet-sidebar.md#minimal-layout-without-a-navbar)
directly.

## Optional Corner styling

Install the Corner components only when the website needs this visual identity:

```bash
pnpm dlx shadcn@4.19.1 add @forge/corner
```

This installs `CornerFrame`, `CornerLabel`, and `CornerRule`, plus the
`corner-tokens` dependency. **Import the installed stylesheet into the host's
global Tailwind CSS entry.** shadcn copies the file but does not add this import.
For example, when the entry is `src/styles.css` and `@lib` resolves to `src/lib`:

```css
@import "tailwindcss";
@import "./lib/forge/corner/tokens.css";
```

Adapt the relative path to the actual stylesheet location. Keep the import after
Tailwind's import and review any later theme declarations that override these
variables. Corner tokens set a global palette and use `prefers-color-scheme` for
dark mode; the import affects the whole website. The generic intranet shell does
not depend on it.

```tsx
import { CornerFrame, CornerLabel, CornerRule } from "@/components/forge/intranet/corner";

<CornerFrame as="section" accent surface="paper" className="p-6">
  <CornerLabel>Workspace</CornerLabel>
  <h1 className="mt-4 text-2xl font-semibold">Projects</h1>
  <CornerRule className="my-4" />
  <p>Your page content.</p>
</CornerFrame>;
```

`CornerFrame` supports `as`, `accent`, `cut`, `surface`, and standard HTML
attributes. The CSS provides clipped frames, hover/focus accent animation, and
reduced-motion handling. The separate Corner preset in `theme-presets` supplies
palette values; it does not replace the signature stylesheet required by these
components.

## Preview and update

Run `pnpm dev --port 3010` and open `/en/intranet`. The showroom uses mock user
and navigation data, a banner control, and a topbar toggle.
`/en/intranet-sidebar` provides focused sidebar behavior checks.

Use the [local registry workflow](../README.md#installing-from-the-registry) to
test changes in a consumer. Publish generated artifacts before updating from the
`main` namespace. Keep host adapters outside generated `forge/` directories;
review changes when rerunning shadcn with `--overwrite`, then validate and deploy
the consumer. Installing this item does not migrate an existing host layout
automatically.
