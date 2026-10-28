# Design

## Context

Baseline: Registry `0b47bb77c2f88154eb62a26ce6e08b841bde5e16`. Reuse the existing pure model, editor session, PostgreSQL history rows and service transaction. See [proposal.md](proposal.md) for scope and [specs/plugins/spec.md](specs/plugins/spec.md) for behavior.

## Goals / Non-Goals

Preserve public interfaces and existing modules. No new editor, versioning framework, comparison mode or dependency. See [tasks.md](tasks.md) for checks and documentation.

## Decisions

### 1. Replace the draft in the existing store

`saveBlogDraft` remains the shared calculation for article state, snapshot and removed IDs. Replace the draft, pointers and image projections atomically, preserving fresh revision IDs, increasing numbers and no-op/idempotent saves.

Update `historyHeaders` bounds with the model and mock. Verify superseded rows and references are removed, not hidden by the read limit. Previous draft saves do not enter publication history.

The editing projection can contain live content without a separate draft row. Preserve the specified deletion fallback and counters without manufacturing a replacement snapshot.

### 2. Confirm resumption, then save

Reuse dirty-navigation guards and confirmation primitives. A saved draft needs replacement confirmation even when clean. Confirmation prepares local input; only a successful save replaces the persisted draft. Cancellation or failure preserves recoverable work.

Bind consent to article version and source/draft identities; invalidate it after a conflict or refresh accepting newer state. Preserve current-client isolation for late completions.

Fix source-equality checking so unedited historical content differing from current work saves as a distinct draft. Never mutate or reuse its source publication's ID.

Stop requiring `repriseId` branches or retention based on `sourcePublicationOrder`. Keep useful provenance and inert compatible JSON fields; update origin validation and callers together without a cleanup migration.

### 3. Publish the current draft without truncating later history

`publishBlogVersion` promotes the draft's identity into publication order without source-based truncation. Retain server-derived removal plans, missing-image confirmation, locks, projections and retry results.

Replace direct historical publication with resume/save/publish; reject old publication targets. Preserve ordinary editor/table publication and no-history clients. Keep operation names where possible and update affected callers together.

### 4. Keep the real reader and comparator

Replace lane drawing in `history.tsx` with chronological rows and the optional draft. Keep `content-sidebar-layout`, responsive controls, metadata, previews, menus and deletion safeguards. Unsaved work gets no committed number.

Reuse `BlogHistoryReader` and `history-diff.ts` against the live language publication, including unsaved draft comparison. Keep paragraph/word changes, whitespace, context, the 50 ms bound, full-text fallback and all field/image comparisons specified in the delta. Preserve safe rendering and the no-live-publication state.

The mockup approves layout and warnings only. Preserve real editor features; reconcile the surface brief's lanes without changing global design or its stale sidecar.

### 5. Preserve service boundaries and update the showroom

Keep localized snapshots in `blogs_history`, private S3 images, validation, readiness, authorization and concurrency checks. Historical signatures never grant current management rights.

Retained references across languages protect images. Preserve cleanup eligibility and retries without starting a new grace period at removal. Distinguish missing images from provider failures and reject foreign assets.

Seed five publications and one draft per English/French translation through `loadHistoryExample`. Preserve article scope and reset behavior. Update `blogs-preview.tsx` help and retain its existing simulations.

Keep `registry/registry.json` ownership, `@components/plugins/blogs` targets, UI/CSS dependencies and `diff`. Update both items together, regenerate endpoints and check a disposable install. Do not distribute showroom code.

## Risks / Trade-offs

- Replaced draft saves are deliberately unrecoverable, including after rollback. Preserve replacement warnings and atomic failure recovery.
- Changes cross model, storage and UI. Keep existing regression coverage, replacing only assertions specific to removed branches and eight-draft retention; do not rewrite the comparator to match the mockup.

## Migration Plan

No historical-data migration is required, as confirmed by the owner. Reuse the schema, startup readiness and normal source-install process. Keep backup and compatible-writer guidance; customer adoption and deployment remain separate.

Reconcile the guides, glossary, ADR-0009 and surface brief during implementation. Apply the delta to the main `plugins` spec through the normal OpenSpec completion/archive workflow, within this single Registry change root.
