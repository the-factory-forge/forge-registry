# Design

Follow ADR-0002 and ADR-0006 for portable UI, host adapters and semantic themes.
Reuse buildMenu or the existing publicMenu service result for visibility,
ordering and translation fallback. MenuPrintPage accepts localized sections and
host branding. MenuItemsPage gains only an optional printHref.

Render the hydrated preview in a light-root iframe. Production CSS can resolve
light-dark tokens at the host root, so a nested light class is insufficient.
Keep SSR paper content as the initial fallback and resize the preview frame to
its content.

Use the existing menu badges and Intl.NumberFormat for a single-column paper
layout. The preview uses light semantic tokens, A4 portrait by default, with A5 landscape available.
Title and footer are local React state. React renders every content string.
No catalog mutation, stored preset or server PDF endpoint is added.

On Print, clone the rendered paper into a same-origin offscreen iframe. Copy
host stylesheet nodes and add scoped print geometry, page size and margins.
Wait for styles, fonts and images, with a bounded preparation timeout. Errors
retain settings for retry. Remove the document after printing, before another
attempt and on unmount. Browser pagination owns overflow; do not build a page
layout engine. Oversized dishes may split to avoid clipping.

Use the existing showroom splat route for /{locale}/admin/menus/print. Preserve
the host-owned route guard and locale contract in integration documentation.
Ship the component with Menus and verify both PDF output and a disposable
shadcn consumer installation. No live consumer deployment is part of this task.
