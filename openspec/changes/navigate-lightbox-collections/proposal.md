# Proposal

## Why

The existing Lightbox opens one image at a time. Visitors browsing a gallery must close and reopen the dialog for each photo, even when the host already supplies an ordered collection.

## What Changes

- Add an optional ordered image collection and selected-image control to the existing Lightbox contract, preserving single-image callers.
- Provide previous/next buttons, ArrowLeft/ArrowRight, horizontal touch swipe, a position announcement and the current image's alternative text/caption.
- Keep focus trapping, Escape, focus restoration, portal rendering and complete-image viewing. A failed image must not trap navigation.
- Let hosts supply the filtered collection, translations and thumbnails. Do not add album persistence, filters, routes, downloads or storage.

## Capabilities

### New Capabilities

- `lightbox`: Accessible single-image enlargement and optional collection navigation.

### Modified Capabilities

None. No existing registry main spec owns Lightbox behavior.

## Impact

Owner and main-spec destination: `forge-registry/openspec/specs/lightbox/spec.md`. Trace `@forge/lightbox` and every manifest item shipping or depending on its source before editing. Update declared dependencies, showroom and generated output through the official builder.

Terminal60 adopts the collection for its currently filtered gallery and uses single-image enlargement elsewhere. Its recovery of original photos, WebP generation, captions and gallery layout remain in change `deliver-reviewed-terminal60-improvements` under `openspec/changes/` in the [Terminal60 repository](https://github.com/the-factory-forge/terminal60). Other recorded Lightbox consumers, including the template, need compatibility review without an automatic rollout. This is a broadly useful image-viewing capability, not a new Gallery plugin.
