## Why

The user wants common restaurant filters without specialized nutrition labels.

## What changes

- Remove Low carb, Keto, Sugar-free and Alcohol-free from the default menu catalog.
- Keep the common dietary labels, all allergen exclusions and host-supplied labels.
- Remove unused icons and update the catalog checks and guide.

## Capabilities

### Modified capabilities

- `plugins`: limit Menus defaults to common restaurant choices.

## Impact

`forge-registry` owns the reusable catalog, generated endpoint, showroom and validation. `forge-spec` owns the shared Plugins requirement. No host adapter, schema or database changes are required.
