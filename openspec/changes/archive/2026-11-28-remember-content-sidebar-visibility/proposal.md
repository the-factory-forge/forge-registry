## Why

Offer actions and blog revision history serve different workflows. The plugin should choose what a first-time visitor sees and remember subsequent choices across records.

## What Changes

Add an initial visibility input and a view-scoped preference to the content sidebar. Apply them to Offers, Blogs and the showroom. Record plugin usage rules beside their source.

## Capabilities

### Modified Capabilities

- `content-sidebar-layout` gains configurable, remembered visibility.

## Impact

Registry source and generated items change in forge-registry. Existing layout slots and the Blogs router binding stay compatible. Hosts receive the behavior when they adopt the updated source.
