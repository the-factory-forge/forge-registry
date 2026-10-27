## Why

The default dietary filters repeat choices already represented by allergen exclusion. The user requested a shorter list.

## What changes

- Remove gluten-free, dairy-free, lactose-free, egg-free, tree-nut-free, peanut-free, soy-free and sesame-free from the default catalog.
- Keep distinct dietary options, all allergen exclusions and supplied custom labels.
- Remove the unused badge icon mappings and update documentation and checks.

## Capabilities

### Modified capabilities

- `plugins`: Menus defaults omit the redundant dietary choices.

## Impact

`forge-registry` owns source, generated endpoints, showroom and tests. `forge-spec` owns the Plugins contract. No schema, host adapter or database changes are required.
