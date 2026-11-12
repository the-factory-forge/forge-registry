# Tasks

Owns reusable Menus behavior. Terminal60 supplies the originating example; adoption does not copy its branding, translations, customer content or storage adapter. Do not update other sites automatically.

## 1. Menu foundation

Precedes all Menus UI/adoption work. One owner for types, service, schema, model and contracts. Suggested commits/diffs: additive menu schema/projection, then authorized mutations.

- [x] 1.1 Add menu and membership contracts, optional descriptions and versioned category/menu state while preserving flat callers; verify model/validation tests and existing Menus/connector type checks, then document the additive API and host-owned migration.
- [x] 1.2 Implement authorized menu CRUD, attach/detach, atomic section/item order and explicit cross-category movement with current membership/version checks; test stale/conflicting/forbidden writes and preserved item content against disposable persistence.
- [x] 1.3 Use one eligibility projection for public menu data and selected-image access, with explicit publication and host clock/period evaluation; test hidden/unpublished/future/ended menus, one remaining live shared menu, unavailable storage and legacy compatibility. Verify upload and authorized/public image reads for composed menus against disposable S3-compatible storage.
- [x] 1.4 Make individual dish prices optional across types, validation, storage, editor and projections; preserve numeric prices and priced sizes, review migration/source compatibility and connector callers, and test absent versus zero prices without coercion. Preserve descriptions as the only set-price and inclusion fields. Verify editable currency labels leave amounts unchanged.

- [x] 1.5 Add menu types, weekday/course sections, and unpublished next-week copies without shared dishes. Verify dates, retries and public eligibility.

## 2. Grouped editing and main photo

Depends on group 1. UI work can start against its settled interfaces, without concurrent edits to the foundation. Keep lifecycle and unsaved-change protections.

- [x] 2.1 Add the menu collection, sticky current menu heading/actions, global labels entry, in-context creation, collapsible indented sections and shared-category editor/usage list with names-only selection, safe category deletion and access to unattached categories; verify pointer, keyboard, narrow/wide and light/dark states, including pending-edit ownership and failure recovery.
- [x] 2.2 Connect category/item drag order and non-drag Move actions, with aligned actions and no permanent category dropdown or extra allergen badges in staff rows; test successful persistence, rollback, client replacement, reduced-motion-safe drop feedback and shared-content safeguards.
- [x] 2.3 Permit explicit visibility at creation and add the optional main-photo field/preview with the existing cropper; test file selection/drop, refreshed dish files, create/upload/associate success and partial failure retry without duplicate dishes, lost drafts or stale-session callbacks. Preserve supplementary Drive storage and document its private/public boundary.
- [x] 2.4 Use a single publication toggle per menu, the common label catalogue with independent dish assignments and a labeled four-stop spice slider; verify pending/error rollback, dated publication status, keyboard operation and preservation of existing label/spice values.

## 3. Public presentation and printing

Depends on group 1; coordinate shared files with group 2.

- [x] 3.1 Add staff-selected lines/photos and host-controlled filters, stable text/photo/price columns, equal base spacing for rows without photos and existing filters/sizes/statuses; verify SSR and narrow/wide keyboard layouts in both themes, including missing photos, long text and empty filter results.
- [x] 3.2 Provide one Preview entry with Web/Paper views, sharing the guest-facing renderer and reusing the existing photo-free printer/settings; verify the same saved menu, staff-only unpublished access, no view-switch side effects, browser print cancellation, attached shared sections/descriptions, absent versus zero prices, hidden-item exclusion, print symbols/legend, flame counts, readable prices and pagination, legacy printing, errors/retry and output without shell controls. Update the printer guide.

## 4. Promotion and distribution verification

Depends on the preceding groups. No source release or rollout is implied.

- [x] 4.1 Update the Menus definition/requirement, labels, neutral showroom and actual manifest/dependency closure, inspecting reverse dependents including `agents-menus-server`; verify affected adapters compile and showroom discovery exposes the supported behavior.
- [x] 4.2 Run required registry formatting/lint, focused persistence/browser tests, `registry:sync`, `registry:check`, type/check/build and a real named-item shadcn install in a disposable consumer; verify imports and dependencies without customer-only source.
- [x] 4.3 Record Terminal60's scoped consumer evidence and affected/unknown follow-ups in the central inventory without overwriting unrelated records; verify originating-site tests and exact installed scope before marking local adoption, then validate this change and review only the task diff for transfer.

## 5. Unassigned dishes follow-up

- [x] 5.1 Allow a null dish category and preserve dishes by default on category deletion. Keep legacy no-options deletion empty-only, protect shared/weekly categories, require an exact dish/version snapshot and make explicit delete-all atomic with the existing file guards. Verify authorization, concurrency, rollback and host migration guidance.
- [x] 5.2 Show unassigned dishes below the menus with search, edit and reassignment. Keep category deletion behind confirmation and exclude unassigned dishes and their images from public and paper output. Verify desktop/mobile recovery, stale confirmations and preserved photo access for staff.
- [x] 5.3 Rebuild and validate shipped source, update the consumer evidence and run the affected unit, storage, browser and distribution checks before promotion.

## Workflow follow-up

- Reconcile deltas into registry `menu-cards` and `plugins`; archive only after implementation, consumer validation and review.
- The user requested local commits for review. Keep the verified changes on `codex/registry-menus-composition`; publication and consumer adoption remain separate steps.
