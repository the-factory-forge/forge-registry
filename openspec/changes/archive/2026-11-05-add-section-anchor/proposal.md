## Why

Employee and profile section titles need shareable URLs that restore their position after reload or delayed rendering.

## What Changes

Add the standalone `@forge/section-anchor` control with native fragment links, visible keyboard focus and a sticky-header offset. Adopt it in TC employee/profile titles while retaining existing fragments and copy feedback.

## Capabilities

### New Capabilities

- `section-anchor`: clickable section titles and fragment restoration.

### Modified Capabilities

None.

## Impact

Registry owns the new component, manifest, generated output, demo, tests and `openspec/specs/section-anchor/spec.md`. TC owns employee fields, profile routes and copy feedback. Forge Specs receives only the consumer inventory update. No existing item depends on this new control; existing plugins and template installations are unchanged.
