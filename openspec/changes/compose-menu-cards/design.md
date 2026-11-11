# Design

## Context

See [proposal.md](proposal.md). Current `@forge/menus` exports flat categories/items and `MenusClient`; its storage companion owns typed Drizzle tables and versioned mutations. Drive owns private file bytes. Terminal60 uses relocated installed copies and site-owned routing, query invalidation, translations and Infomaniak transport. Registry main has newer Menus lifecycle rules than the customer's installed baseline; preserve those rules rather than copying its editor wholesale.

## Goals / Non-Goals

Add the common restaurant case of multiple cards and reusable sections with the least change to existing integrations. Preserve current APIs until explicit card adoption. Weekly scheduling UI, import data, recursive taxonomies, album persistence and storage-key migrations remain outside this reusable change.

## Decisions

### Additive card records and explicit adoption

Add card records and ordered card/category associations alongside existing category/item IDs. Categories gain optional translated descriptions and a concurrency version for shared edits. Card period/publication and display mode are card attributes; the host supplies its effective date/clock policy. Keep existing flat methods functional and add explicit card operations instead of silently changing the meaning of `publicMenu(locale)` for old callers. Once a host opts into card mode, all public menu and photo reads use the same eligibility projection.

Ordering belongs to the card/category association and the category's dish list. Atomic operations use existing typed transactions and durable locks, complete expected membership and versions. Moving between categories locks/checks both source and destination. Detaching keeps the category and its dishes. An empty category can be deleted only when no other card uses it. Staff can find unassigned categories in a dedicated view.

### Keep editing responsibilities together

Extend the existing editor/list lifecycle modules and exported pages rather than adding a parallel management application. Shared categories render read-only within cards, expose their participating cards and open an explicit common editing context. Card/category descriptions are optional. Collapsible sections use the existing accessible controls; reorder retains pointer/touch and keyboard support with a menu action for non-drag movement. Expose global labels management through a host link independent of the current card.

Keep minor-unit prices and existing priced sizes, but allow a dish without an individual price. Absence is distinct from zero, which remains a real price. A genuinely different offer uses independent categories; this change does not introduce per-card item overrides or a second dish-assignment model.

### Confirmed team review

Terminal60's review placed card actions beside the sticky heading. Support an ordered collection of cards, with the current card's sticky heading replaced by the next rather than stacked. Preview and settings sit beside their card title; Printing is reached through Preview, not a duplicate card action. Keep pending edits associated with their owning record when the viewport changes. The host owns sidebar links, current-section URL state and progressive loading; do not add a router dependency to reusable controls.

Use one clickable publication status per card, without duplicate Publish/Unpublish buttons. Keep explicit publication, eligible dates, failure recovery and immediate updates after saving visible dishes. Reuse the Blogs publication control where it fits. Menus saves current content directly.

Expose one global label-catalogue destination for all cards; every dish keeps its own assignments. Group allergens and dietary preferences within that common management surface rather than creating one catalogue per card. Terminal60 owns installing the existing editable presets; installation must not assert labels on dishes. Keep the existing spice values 0, 1, 2 and 3, presented as a labeled four-stop slider.

### Simple set-menu content

The user accepted the existing Card / Category / Dish structure for set-menu examples: categories can be named "Menu I" and "Menu II". A forfait such as "88 CHF per person" belongs in the existing translated card description, or a category description when offers differ. Dishes can omit their price. Descriptions must appear in both web and paper views. Do not infer totals, included/free status or choices from that text, and do not add a Formula entity, price inheritance or ordering engine.

Optional prices widen a previously required contract. Review types, model validation, persistence, editor parsing, public/print formatting, agents connector and host consumers together. Preserve all stored numeric prices and require a reviewed forward migration; an empty field must never silently become zero. Source compatibility and migration guidance must name affected consumers rather than promising unchanged nullable types.

### Host-owned choices

Registry ships neutral labels and configurable locales. Terminal60 owns its FR/EN/DE text, weekly layout, formula presentation, seed and storage paths.

### Main photo uses existing Drive storage

Reuse `ImageCrop`, current byte validation and selected-entry deletion guard. Keep a single optional main-image preview in the form, accepting local file selection before item creation. Save once, keep the canonical identity/version, then upload to that item's private scope and associate the result. Preserve failed/pending state and edits across retry. Supplementary files remain private and can still be managed through the existing Drive surface. No folder API is removed, no Gallery dependency is added and no storage prefix changes.

### Public display and printing

Use a shared card projection and renderer for public and staff preview data, with staff access able to inspect saved unpublished cards. Preview never publishes or exposes an anonymous preview URL. Public eligibility checks card publication, host-evaluated period and item visibility; selected images use that same rule at request time. Keep no-store image responses. Portable controls expose view/filter values and callbacks, with a compatible uncontrolled fallback for older callers. Hosts bind URL state.

Rows use text, optional image and price columns, with a reserved image slot and the same base row height/spacing in photo mode even without an image. Long content must remain readable without clipping. Reuse the existing printer, passing one card projection instead of the global menu. Keep its isolated iframe, loading/error recovery and photo-free content. Specialized weekly matrices belong in the host.

There is one Preview entry with Web and Paper views for the same saved card. Web uses the guest-facing renderer; Paper uses the existing print preview, retains its settings and exposes Print. Only Print opens the browser's confirmation/cancellation dialog. Switching views has no publication or print side effects. Do not add another application confirmation or a separate View on site action for unpublished cards.

### Distribution and consumers

Trace and update `menus` and `menus-storage` manifest files/dependencies, plugin definition, English labels and neutral showroom adapters. Inspect `agents-menus-server` for changed method assumptions without installing Agents in Terminal60. `drive-storage`, crop controls and shared UI remain existing dependencies; alter them only if an acceptance check proves a common defect. Regenerate `public/r` with the official builder and test named-item installation in a disposable consumer.

Terminal60 is the recorded Menus consumer; the template does not install Menus. Verify the inventory and reverse dependencies before source changes. Record unknown consumers as pending. Promotion uses the bounded `sync-to-forge-registry` procedure; other customer sites are not part of this rollout.

## Risks / Trade-offs

- Additive compatibility temporarily supports flat and card reads. Keep explicit adoption and test both interfaces rather than using a runtime feature switch.
- Shared writes can affect multiple views. Versions, atomic membership checks and the common editor prevent silent overwrites.
- Photo upload spans storage and metadata. Preserve item identity and retryable cleanup instead of promising an impossible cross-store transaction.
- Unpublishing can change image access. Test no eligible cards, one remaining live card, unavailable bytes and unauthorized staff operations.

## Migration Plan

Ship schema exports and migration guidance, not automatic SQL execution. Hosts generate their own incremental history, backfill existing categories into an explicit card and test fresh/populated upgrades before adoption. Do not rewrite previous SQL, move S3 objects or seed production records. Reconcile completed deltas into registry `menu-cards` and `plugins`, then archive only after implementation and distribution checks pass.
