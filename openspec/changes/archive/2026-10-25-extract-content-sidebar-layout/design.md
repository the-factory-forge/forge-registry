# Design

## Scope and reuse

The reusable arrangement is a flexible main column with a 22rem supporting column at the existing large breakpoint. SubpageSidebar owns navigation and a mobile drawer; the public blog category sidebar has different sizing and disclosure behavior. Neither is migrated merely for visual similarity.

## Interface

`ContentSidebarLayout` accepts `children`, optional `toolbar` and `sidebar` React nodes, and `className`. Callers supply semantic landmarks, labels, buttons, loading/error content and visibility state. No router, history state, palette, JavaScript measurement or additional dependency belongs in the layout.

## Behavior

Keep toolbar and panel together in a sticky desktop column beneath `--intranet-top-offset` (zero by default), with existing 1rem viewport clearance and 1.5rem spacing. The toolbar cannot shrink; a long panel scrolls in the remaining height. Mobile places both above content in normal page flow. A missing sidebar leaves the toolbar above full-width content. Keep the content wrapper mounted across panel toggles so uncontrolled fields and focus survive.

## Distribution and validation

Register the file under layouts with `@forge/cn`. Blogs imports the layout and declares its registry dependency; History relinquishes its scrolling classes. Rebuild generated output using shadcn. Test the standalone example, existing blog scroll regression, no-sidebar state, long panels and narrow layouts in both themes. Install the layout and Blogs through a disposable shadcn consumer to verify dependency resolution. Preserve the original checkout's unrelated showroom and storage edits when transferring the incremental diff.
