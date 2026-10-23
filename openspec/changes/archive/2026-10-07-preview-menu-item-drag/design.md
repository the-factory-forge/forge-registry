# Design

Extend the existing pointer-capture implementation in MenuItemsPage. After a
small movement threshold, render an inert name/category preview in a React portal
so table scrolling cannot clip it. Use host semantic colors and keep the preview
inside the viewport. Fade the original row while preserving table geometry.

Use each hovered row's vertical midpoint to select its before/after insertion
edge. Calculate the destination after removing the source from the list. Draw
the line with inset cell shadows to avoid shifting rows or overriding sticky
action cells. Use the same destination for saving. Clear stale targets outside
the table and on cancellation. Preserve atomic saving, search gating, failure
recovery and keyboard controls.

Extend the existing browser suite to cover preview identity, insertion edges,
mouse/touch dropping, cancellation, theme/mobile layout and existing saves.
Regenerate distribution and verify an official disposable consumer install.
