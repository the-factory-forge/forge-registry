# Subpage sidebar

`@forge/subpage-sidebar` supplies navigation beside a page's content. It shares
its grouped links, nested expansion, active styles and mobile breakpoint with
[`intranet-sidebar`](./intranet-sidebar.md), without branding, authentication,
a user menu, viewport positioning or a global keyboard shortcut.

Install with `shadcn add @forge/subpage-sidebar`. The component uses the host's
semantic sidebar tokens and includes its source dependencies through
`@forge/sidebar-navigation`, `@forge/icon-tooltip`, `@forge/ui-shims` and `@forge/cn`.
It does not depend on showroom styles or auth.

```tsx
import { SubpageSidebar } from "@/components/subpage-sidebar";

<div className="flex min-w-0 flex-col gap-5 md:flex-row">
  <SubpageSidebar
    label="Project navigation"
    closeLabel="Close project navigation"
    pathname={pathname}
    linkComponent={RouterLink}
    groups={[
      {
        id: "project",
        items: [
          { id: "overview", label: "Overview", href: "/project", exact: true },
          {
            id: "documents",
            label: "Documents",
            href: "/project/documents",
            items: [{ id: "brief", label: "Brief", href: "/project/documents/brief" }],
          },
        ],
      },
    ]}
  />
  <div className="min-w-0 flex-1">{children}</div>
</div>;
```

Groups accept an optional label and footer. Items accept an icon, a destination,
nested items, or both. A linked parent has separate navigation and expansion
controls. Use `exact` for an exact current route and `collapsible: false` for a
permanently expanded group. A local view can instead supply `onSelect` and
`active`. Links can supply `onNavigate` to update local view state before normal
navigation. Hosts own permission filtering and route authorization.

Supply `label`, `closeLabel`, and `labels.expand` / `labels.collapse` for translation.
`className` applies to the local sidebar wrapper. Below 768px, a labeled button
opens a modal drawer with focus trapping, Escape dismissal and focus restoration.
Ordinary link navigation and local selection close it. Modified link clicks retain
normal browser behavior. There is no duplicate global Cmd/Ctrl+B handler.

A group's footer may be a function receiving a navigation-close callback. Drive
uses this to render its paginated, lazy folder tree with the same navigation
styles. Call the supplied callback after ordinary navigation in custom content.

The [showroom example](../src/routes/subpage-sidebar.tsx) demonstrates nested destinations; the
[Drive example](./drive.md) integrates folders and Trash.
Existing intranet sidebar exports remain compatible. Installing its update also
installs the shared navigation renderer and mobile hook; preserve host link adapters.
