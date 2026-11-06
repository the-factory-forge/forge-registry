## Context

TC already has an AnchoredCardTitle copy button and stable profile IDs, but its title text and HR sections are not links. The existing page-specific scroll hook duplicates restoration and strips a character from the router hash.

## Goals / Non-Goals

Use ordinary links for clicks, keyboard navigation, sharing and reloads; handle delayed targets and preserve native hash history. Preserve host fields, permissions, paths and existing URLs. Do not add a router dependency, clipboard system, table of contents or automatic heading discovery.

## Decisions

`SectionAnchor` accepts an explicit stable ID, children and className. A native anchor owns its ID and fragment; an effect restores the matching target after mount. Invalid fragments are ignored and scrolling is immediate. Hosts supply the heading element and may adjust scroll margin. New registry examples use factory-prefixed IDs; TC retains established unprefixed IDs for compatibility.

Only `@forge/cn` is needed. Source installs at `@components/section-anchor.tsx`; TC relocates it under `src/components/forge/` and uses its own cn. No reverse dependencies or plugin refresh are introduced. TC and the showroom restore marked section links after the router renders so cached scroll positions cannot override explicit section URLs; other consumers keep their framework-specific wiring.

## Risks / Trade-offs

Targets must exist; collapsed or unauthorized sections cannot be opened by this control. IDs are public URL identifiers and must be stable and unique. Source distribution does not deploy or update other consumers.
