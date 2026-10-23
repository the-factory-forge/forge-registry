## Why

Basic controls such as native selects clutter the showroom homepage alongside
complete components and plugins. The directory should focus on composed UI.

## What changes

- Remove Native select, Icon tooltip and Action toast cards, preserving their demos.
- Limit homepage listings to composed components, page sections, layouts and plugins.
- Align contributor guidance and browser checks with that distinction.

## Capabilities

### Modified capabilities

- `registry-distribution`: distinguish homepage listings from basic control demos.

## Impact

The owning OpenSpec root is `forge-spec/openspec`. Affected repositories are
`forge-spec` for the contract and `forge-registry` for the directory, guidance
and tests. Distributed source, public APIs and consumer installations are unchanged.
