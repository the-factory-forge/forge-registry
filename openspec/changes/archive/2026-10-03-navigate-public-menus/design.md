## Context

`MenuPage` receives ordered, localized categories and renders all matching
sections. Allergen and dietary filters already omit categories without matches.
The Menus item declares framework shims and semantic theme dependencies.
ADR-0002 and ADR-0006 preserve portable source and host styling responsibilities.

## Decisions

Derive category links from the same filtered sections as the menu. Use the
existing Link shim and native fragments with instance-prefixed IDs. Keep all
sections rendered and track the current section while scrolling. Links use
`aria-current` rather than tab-panel roles because they navigate within a page.

The row uses sticky positioning and horizontal overflow on narrow screens.
`--menu-top-offset` defaults to zero; hosts with fixed headers can set it through
the existing `className` prop. Scroll margins include the offset and navigation
height. The showroom supplies its existing header offset. No required prop,
stylesheet or package is added. The accessible navigation label reuses
`labels.categories` and category names remain supplied by the host.

## Verification

Run the existing menu browser suite for keyboard jumps, sticky placement,
current-section tracking, translated navigation, filter changes and narrow
light/dark layouts. Run repository checks, regenerate endpoints and inspect
the rendered example. Validate the shared requirement and reconcile it into
the Plugins spec. Storage behavior is unchanged.
