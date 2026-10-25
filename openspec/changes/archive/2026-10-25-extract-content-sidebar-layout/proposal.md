# Proposal

## Why

The blog editor now combines controls and a sticky supporting panel beside its content. Reusing that arrangement should not require copying its viewport offsets, scrolling constraints or responsive grid.

## What Changes

- Add a portable content/sidebar layout with content, toolbar and optional panel slots.
- Adopt it in the blog editor while retaining history ownership, focus and open/close behavior.
- Ship a registry item, dependency declaration, guide and interactive showroom example.

## Capabilities

### New Capabilities

- `content-sidebar-layout`: Responsive content with a sticky supporting panel and persistent panel controls.

### Modified Capabilities

None. Existing blog history behavior is preserved.

## Impact

Owned entirely by forge-registry. Adds `@forge/content-sidebar-layout` under `@components/layouts/`; Blogs declares it as a dependency, also reaching Blogs Storage installs through their existing dependency. No new npm dependency or changes to routing, persistence or consumer adapters. Recorded Blogs consumers (l-aspic and osthoepathie-seebach) require the new dependency when adopting updated source; their installed history support and deployment remain separately reviewed. No customer update is part of this task.
