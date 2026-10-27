# Sort menu filter labels

## Why

Menu filters currently follow catalog or supplied order. Alphabetical choices
make the allergen and dietary groups easier to scan in each displayed language.

## What Changes

- Sort public allergen and dietary choices alphabetically by displayed names using the current locale.
- Apply the same order to assigned custom labels and supplied overrides.
- Retain assigned-only availability, stable label IDs and the full staff catalog.

## Impact

- Owning OpenSpec root: forge-spec. Affected capability: Plugins, Menus requirement.
- Implementation belongs in forge-registry's shared filter helper, tests, guide and generated Menus distribution.
- Existing signatures remain; supplied ordering no longer controls public filter order. No schema or migration change. Hosts refresh installed source to adopt it.
