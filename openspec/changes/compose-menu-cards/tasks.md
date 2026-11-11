# Tasks

This draft includes card storage, publication and private preview, the public card renderer, Web/Paper views and optional dish prices. The remaining tasks cover the staff workspace, common category mutations, drag-and-drop and the dish photo workflow.

Owns reusable Menus implementation only. Terminal60 adoption and weekly behavior are tracked in its `deliver-reviewed-terminal60-improvements` change. Use `sync-to-forge-registry` for this bounded behavior; do not copy customer files wholesale or update other sites automatically. Each group includes its own verification and documentation.

## 1. Card foundation

Precedes all Menus UI/adoption work. One owner for types, service, schema, model and contracts. Suggested commits/diffs: additive card schema/projection, then authorized mutations.

- [ ] 1.1 Add card and membership contracts, optional descriptions and versioned category/card state while preserving flat callers; verify model/validation tests and existing Menus/connector type checks, then document the additive API and host-owned migration.
- [ ] 1.2 Implement authorized card CRUD, attach/detach, atomic section/item order and explicit cross-category movement with current membership/version checks; test stale/conflicting/forbidden writes and preserved item content against disposable persistence.
- [ ] 1.3 Use one eligibility projection for public card data and selected-image access, with explicit publication and host clock/period evaluation; test hidden/unpublished/future/ended cards, one remaining live shared card, unavailable storage and legacy compatibility, recording the access contract.
- [ ] 1.4 Make individual dish prices optional across types, validation, storage, editor and projections; preserve numeric prices and priced sizes, review migration/source compatibility and connector callers, and test absent versus zero prices without coercion. Preserve existing descriptions as the only set-menu forfait/inclusion fields.

## 2. Grouped editing and main photo

Depends on group 1. UI work can start against its settled interfaces, without concurrent edits to the foundation. Keep lifecycle and unsaved-change protections.

- [ ] 2.1 Add the card collection, sticky current-card heading/actions, global labels entry, in-context creation, collapsible indented sections and shared-category editor/usage list with names-only selection; verify pointer, keyboard, narrow/wide and light/dark states, including pending-edit ownership and failure recovery.
- [ ] 2.2 Connect category/item drag order and non-drag Move actions, with aligned actions and no permanent category dropdown or extra allergen badges in staff rows; test successful persistence, rollback, client replacement and shared-content safeguards.
- [ ] 2.3 Permit explicit visibility at creation and add the optional main-photo field/preview with the existing cropper; test create/upload/associate success and partial failure retry without duplicate dishes, lost drafts or stale-session callbacks. Preserve supplementary Drive storage and document its private/public boundary.
- [ ] 2.4 Use a single publication toggle per card, the common label catalogue with independent dish assignments and a labeled four-stop spice slider; verify pending/error rollback, dated publication status, keyboard operation and preservation of existing label/spice values.

## 3. Public presentation and printing

Depends on group 1; coordinate shared files with group 2.

- [ ] 3.1 Add staff-selected lines/photos and host-controlled filters, stable text/photo/price columns, equal base spacing for rows without photos and existing filters/sizes/statuses; verify SSR and narrow/wide keyboard layouts in both themes, including missing photos, long text and empty filter results.
- [ ] 3.2 Provide one Preview entry with Web/Paper views, sharing the guest-facing renderer and reusing the existing photo-free printer/settings; verify same saved-card content, staff-only unpublished access, no view-switch side effects, browser print cancellation, attached shared sections/descriptions, absent versus zero prices, hidden-item exclusion, legacy printing, errors/retry and output without shell controls. Update the printer guide.

## 4. Promotion and distribution verification

Depends on the preceding groups. No source release or rollout is implied.

- [ ] 4.1 Update the Menus definition/requirement, labels, neutral showroom and actual manifest/dependency closure, inspecting reverse dependents including `agents-menus-server`; verify affected adapters compile and showroom discovery exposes the supported behavior.
- [ ] 4.2 Run required registry formatting/lint, focused persistence/browser tests, `registry:sync`, `registry:check`, type/check/build and a real named-item shadcn install in a disposable consumer; verify imports and dependencies without customer-only source.
- [ ] 4.3 Record Terminal60's scoped consumer evidence and affected/unknown follow-ups in the central inventory without overwriting unrelated records; verify originating-site tests and exact installed scope before marking local adoption, then validate this change and review only the task diff for transfer.

## Workflow follow-up

- Reconcile deltas into registry `menu-cards` and `plugins`; archive only after implementation, consumer validation and review.
- Transfer the verified diff to the recorded registry checkout uncommitted, preserve existing work and clean up the isolated worktree after verification. Do not push, publish or update other customer sites.
