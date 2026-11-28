# Content sidebar layout

`@forge/content-sidebar-layout` arranges primary content beside an optional
supporting panel. Offers uses it for Actions and Blogs uses it for History.
Use it for page details, review checklists or supporting controls; use
[Subpage sidebar](./subpage-sidebar.md) for nested navigation with a mobile drawer.

Install with `shadcn add @forge/content-sidebar-layout`.

```tsx
import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";
import { viewPreferenceKey } from "@/components/utils/view-preference";

<ContentSidebarLayout
  defaultOpen={false}
  preferenceKey={viewPreferenceKey("projects", "editor", "details")}
  renderHeader={(open, setOpen) => (
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      Details
    </button>
  )}
  sidebar={<aside aria-label="Details">{details}</aside>}
>
  <EditForm />
</ContentSidebarLayout>;
```

| Prop            | Purpose                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `defaultOpen`   | Initial visibility when there is no valid saved choice. Defaults to `true`.                                    |
| `preferenceKey` | Stable localStorage key for this plugin view. Omit for in-memory state.                                        |
| `renderHeader`  | Renders a header above the grid with the current visibility and setter. Keep its toggle reachable when closed. |
| `children`      | Primary content, kept mounted when visibility changes.                                                         |
| `toolbar`       | Optional controls above the panel or above full-width content when closed.                                     |
| `sidebar`       | Supporting content. Omit when unavailable.                                                                     |
| `className`     | Classes merged onto the grid.                                                                                  |

Choose an open default for core workflows such as issuing offers and a closed
default for optional information such as revision history. Each explicit choice
is remembered across records and languages in the same browser and origin.
The toggle works for the current visit if browser storage is unavailable.

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

Supply semantic landmarks, translated labels, focus management and loading or error
feedback. For an external trigger or router-controlled panel, use the exported
`useContentSidebarPreference(preferenceKey, defaultOpen)` hook. It returns
`[open, setOpen]`. Pass the visible panel to the layout’s existing `sidebar` slot.

The [showroom example](../src/routes/content-sidebar-layout.tsx) demonstrates
a persistent toggle, preserved form input and a long review checklist.
