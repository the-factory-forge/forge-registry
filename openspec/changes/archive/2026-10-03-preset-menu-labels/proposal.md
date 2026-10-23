## Why

Plain menu labels are difficult to scan, and the public filters currently show
only labels used by the demo dishes. Add recognizable icon badges and a complete
starting catalog of common allergen and dietary options.

## What changes

- Add per-label icons and semantic success, pending and informational badges to dishes, filters and the staff item editor.
- Populate public filters with 14 standard allergen groups and common dietary options, translated into English, French, German and Italian.
- Export the catalog and badge component, preserve existing host label IDs and custom labels, and allow hosts to replace unused defaults.
- Seed the showroom taxonomy with the catalog while leaving production data under host control.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `plugins`: Menus label presentation and default filter catalog.

## Impact

The owning OpenSpec root is forge-spec. Source, manifest, showroom, guide, tests
and generated Menus endpoints change in forge-registry. No new dependency or
storage schema is required. Existing page calls adopt the default catalog;
`filterLabels={[]}` retains choices based only on assigned dish labels. Existing
host IDs remain the filter identifiers, and no dish labeling is inferred.
Production database seeding, consumer updates and deployment remain host actions.
