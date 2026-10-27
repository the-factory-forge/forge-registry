# Use assigned menu filters

## Why

Unused public filter choices add clutter and dietary choices can return no dishes
before guests have selected anything else. Staff still need the complete catalog
when editing menu items.

## What Changes

- Show public allergen and dietary choices only when a visible menu item uses that label.
- Keep available choices stable while guests filter dishes.
- Preserve the complete catalog in menu taxonomy and item editors.

## Impact

- Owning OpenSpec root: forge-spec. Affected capability: Plugins, Menus requirement.
- Implementation: forge-registry's shared filter helper, tests, guide and generated Menus distribution.
- No data migration, new dependencies or customer checkout changes. Hosts refresh installed registry source to adopt the behavior.
