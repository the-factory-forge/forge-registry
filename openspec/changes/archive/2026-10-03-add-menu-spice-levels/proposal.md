## Why

Spiciness describes a dish's heat, not a dietary requirement. Guests need a simple indicator with one, two or three icons and staff need to save that level independently.

## What changes

- Remove Spicy from the default dietary catalog.
- Add optional dish spice levels from zero to three, a staff radio group and a public flame badge with translated text.
- Persist the level through Menus storage, validate its range and ship an incremental upgrade migration.
- Preserve old dishes and edits from clients that omit the new field.

## Capabilities

### Modified capabilities

- `plugins`: Menus supports independently stored heat information.

## Impact

This owning change lives in `forge-spec`. `forge-registry` owns UI, types, the storage companion, official generated distribution and showroom/tests. Hosts adopting storage must apply the new incremental migration through their existing workflow. Installation does not change live databases or retire legacy labels.
