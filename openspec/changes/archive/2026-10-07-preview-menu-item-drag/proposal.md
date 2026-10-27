# Preview menu item dragging

## Why

The menu table highlights a target row but does not show the dragged item or
the insertion edge. Staff need to see the proposed position before dropping.

## What Changes

- Show a floating item name/category preview and fade its source row during dragging.
- Mark the exact insertion edge and save the matching order on drop.
- Clear feedback on Escape, pointer cancellation and invalid or unchanged drops.

## Impact

- Owning change root: forge-spec. Affected capability: Plugins, Menus drag feedback.
- Implementation: forge-registry's MenuItemsPage, guides, browser checks and generated Menus item.
- Existing props, optional reorder client, keyboard controls and storage remain compatible. No dependency or migration is added. Consumers refresh source to adopt the feedback.
