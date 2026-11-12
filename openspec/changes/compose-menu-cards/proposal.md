# Proposal

## Why

Restaurants need separate menus for food, drinks or set offers. Staff should be able to reuse a category across menus without entering its dishes twice.

## What changes

- Staff compose menus from ordered categories and create or reorder dishes in place. Shared categories show which menus they affect. Removing a category from a menu preserves its dishes and files.
- Deleting a category preserves its dishes by default. Staff can reassign them from an unassigned-dishes section, or explicitly delete the category’s contents in the confirmation.
- Staff choose a standard, set or weekly menu. A weekly menu can start from the previous week’s structure, with no dishes and no automatic publication.
- Staff control publication and choose a lines or photos layout. One private preview shows the saved menu on Web or Paper, including before publication.
- A dish can have no individual price. Staff can choose its visibility and add an optional cropped main photo before the first save. Supplementary files stay private.
- One catalogue serves all menus. Staff assign allergens and dietary preferences per dish and select one of the four existing spice levels.

## Scope

Forge Registry owns the reusable Menus plugin and its storage companion. Existing integrations that use a flat list can adopt menus later through a forward migration. The change updates the [menu composition](specs/menu-cards/spec.md) and [Menus plugin](specs/plugins/spec.md) requirements.

Terminal60 owns its branding, translated copy, content and storage adapter. A set offer uses menu and category descriptions, with no pricing calculation or order flow.
