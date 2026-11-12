# Design

## Context

The current `registry/components/lightbox.tsx` uses Base UI Dialog, the Image shim and IconTooltip. It renders a portal and one full image. Existing consumers supply `src`, `alt` and optional custom thumbnail children. Terminal60's gallery creates one independent instance per thumbnail.

## Goals / Non-Goals

Extend that viewer with ordered navigation while retaining single-image callers. Keep albums, collection filters, router state, image transformations and S3 outside this component.

## Decisions

Add an optional stable-ID collection and initial/controlled active identity to the existing API, preserving current props. Hosts supply only the collection currently being viewed. Use component-local dialog interaction and the host callback for controlled selection, deriving a valid active image when props change. Do not add a carousel dependency for image switching.

Reuse Base UI's focus trap, portal and close/focus-return lifecycle. Use existing IconTooltip buttons and translated labels for close/previous/next, plus a polite position announcement. Handle horizontal gestures only when displacement and direction clearly indicate a swipe; ignore vertical gestures and canceled pointers. Collection navigation wraps at the ends; single-image use omits arrows. Keep handlers inside the open dialog so page arrow keys retain their normal behavior.

Image loading and failure state must retain controls. Complete-image sizing uses containment, with safe viewport space for caption and controls on narrow screens. Reduced-motion behavior stays usable without animation. Preserve custom children so host thumbnails and their responsive loading do not change.

Update the manifest's actual source/dependency closure, neutral showroom example and generated output. Verify the template's and recorded sites' single-image call shapes, and Terminal60's filtered collection separately. Existing consumer records are evidence pointers, not a claim of exhaustive usage. Use `sync-to-forge-registry` for the scoped promotion and record other sites as follow-ups.

## Risks / Trade-offs

- Swipe can conflict with page gestures. Require a clear horizontal gesture and leave vertical gestures alone.
- Host filters can remove the active image. Reconcile by stable ID or close an empty collection, never retain an invalid index.
- Changing captions can shift content. Keep image containment and visible controls at 320 pixels, with keyboard and focus-return checks.

## Migration Plan

The new API is additive and needs no database or object migration. Adopt the collection only in Terminal60's gallery; retain existing single-image callers elsewhere. Reconcile the delta into registry `lightbox` after browser and distribution checks, then archive.
