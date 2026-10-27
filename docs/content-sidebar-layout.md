# Content sidebar layout

`@forge/content-sidebar-layout` arranges primary content beside an optional
supporting panel. It is the layout used by the blog editor's History panel.
Use it for page details, review checklists or supporting controls; use
[Subpage sidebar](./subpage-sidebar.md) for nested navigation with a mobile drawer.

Install with `shadcn add @forge/content-sidebar-layout`.

```tsx
import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";

<ContentSidebarLayout
  toolbar={<DetailsToggle expanded={detailsOpen} onClick={toggleDetails} />}
  sidebar={detailsOpen && <aside aria-label="Details">{details}</aside>}
>
  <EditForm />
</ContentSidebarLayout>;
```

`DetailsToggle`, `EditForm` and the state in this example belong to the caller.
The layout exports `ContentSidebarLayoutProps` and accepts:

| Prop        | Purpose                                                              |
| ----------- | -------------------------------------------------------------------- |
| `children`  | Primary content; stays mounted when the panel changes.               |
| `toolbar`   | Optional caller-owned controls above the supporting panel.           |
| `sidebar`   | Optional supporting content; omit it to use full-width main content. |
| `className` | Classes merged onto the outer grid.                                  |

When the layout has at least 64rem of available width, content uses a
flexible left column and the supporting panel uses a 22rem right column. The
panel and toolbar stick 1rem below `--intranet-top-offset`, defaulting to `0rem`.
Set that existing variable on an ancestor when the host has a fixed or sticky
header. The panel scrolls within the remaining viewport height while the toolbar
remains visible. Leave ancestor overflow visible so page scrolling controls the
sticky position; a deliberately nested scroll container needs its own compatible
height and offset arrangement.

Below that container width, toolbar, panel and content stack in normal page flow. The
panel expands to its content height. Without a panel, the toolbar stays above
full-width content; without either slot, only the content wrapper remains.

Supply semantic landmarks, translated labels, focus management, visibility state,
and loading/error feedback in the slots. The layout adds no content, state,
controls, borders or theme colors, and works during server rendering without
browser APIs. It ships with `@forge/cn` and needs the host's Tailwind source scanning,
without any showroom stylesheet or provider.

The [showroom example](../src/routes/content-sidebar-layout.tsx) demonstrates
panel toggling, preserved form input and a long review checklist. Blogs now declares
the layout dependency; include it when adopting updated Blogs source. Existing
customer sites are unchanged until their source is updated and deployed.
