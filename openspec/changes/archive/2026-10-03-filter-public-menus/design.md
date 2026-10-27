## Context

`MenuPage` receives localized `MenuViewCategory` items with stable label IDs and
allergen/dietary kinds. The server already omits hidden dishes. The showroom is
its registry caller; Terminal60 supplies French labels and an image URL adapter.
The existing Menus manifest ships the public component and labels and declares
React host integration, Lucide, framework shims and semantic theme dependencies.

## Decisions

Keep selections in `MenuPage` browser state while preserving its full SSR menu.
Derive unique choices from the original supplied items, so filtering never removes
a selected control. Match stable IDs rather than translated names. Ignore selected
IDs no longer present in the supplied menu. An item must have none of the selected
allergens and all selected dietary labels. Preserve item/category order and sold
out states. Omit empty categories and announce the result count or empty message.

Use native checkbox groups with visible instructions and a clear button. Decorative
icons distinguish the groups; selected controls reuse pending and success semantic
color pairs already required by Menus. No stylesheet or dependency is added.
New translation fields remain optional in `MenusLabels`, preserving host objects
typed against that interface. English defaults and existing page props remain.

## Verification

Cover multiple selections in each group, their intersection, no results, reset,
keyboard use, label deduplication, French overrides and narrow light/dark layouts
through the existing browser suite. Run the repository checks, regenerate endpoints
and install Menus into a disposable shadcn consumer. Reconcile the Plugins module
requirement before archiving. No storage behavior changes require database tests.
