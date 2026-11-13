# Menus

Read the [integration guide](../../../../docs/menus.md) and affected requirement sections:

- [Items](../../../../openspec/specs/plugins/spec.md#requirement-menus-plugin),
  [printing](../../../../openspec/specs/plugins/spec.md#requirement-menu-printing) or
  [drag feedback](../../../../openspec/specs/plugins/spec.md#requirement-menu-item-drag-feedback).
- Active changes: [composition](../../../../openspec/changes/compose-menu-cards/specs/menu-cards/spec.md)
  and [photos/visibility](../../../../openspec/changes/compose-menu-cards/specs/plugins/spec.md).

The parent guide identifies shared requirements. Consult the
[design decisions](../../../../openspec/changes/compose-menu-cards/design.md)
when revisiting choices; update active-change links when archiving.

## Logic and ownership

- `workspace.tsx` composes the grouped manager and its unassigned sections;
  `admin.tsx` keeps the flat directory and taxonomy pages. `editor.tsx`, `use-menu-items.ts` and
  `use-categories-and-labels.ts` own distinct editor, list and taxonomy lifetimes.
  Replacing the client starts a new session; departed completions cannot update it.
  Saving snapshots the editor and preserves typing made while the save is pending.
- `model.ts` validates inputs and builds menu views. Prices use integer minor
  units; the host supplies currency. Missing translations fall back to the base
  locale for the whole entity. Hidden items leave public views; sold-out items stay.
- `public.tsx` keeps the flat visitor view; `composed-public.tsx` and `weekly.tsx`
  render composed menus with allergen exclusions and required dietary labels.
  `print.tsx` handles A4/A5 output. `label-presets.ts` owns shared label/icon data;
  customer menu copy and visual branding remain host-owned.
- `server/service.server.ts` checks authorization, versions and taxonomy relations.
  Reordering validates complete item/version lists. Grouped moves update both
  categories atomically; category deletion checks the complete dish snapshot.
  Stale/missing/duplicate rows reject the write.
- The storage companion uses Drive for item images. The host resolves `menu-item`
  scopes and installs `menuImageDeleteGuard`; selected images cannot be removed or
  trashed. Public image access checks the visible item's exact current reference.

## Change boundaries

Treat item ordering, taxonomy and image operations as coordinated writes. Preserve
the shared lock scopes when changing persistence. Optional sizes, spice levels and
label icons retain their omission semantics at validation boundaries.

The editor's native unload protection and host router guard cover different
departures. Preserve both and keep pending saves from navigating away. Confirmed
bulk deletion retains its original client even when the list session changes.

## Checks

Use [model tests](../../../../tests/menus.test.mjs),
[service input tests](../../../../tests/plugin-service-inputs.test.mjs) and the
relevant `tests/menu*.browser.mjs` flow, including printing when output changes.
Persistence and image changes need the
[Menus storage harness](../../../../tests/menus-storage/storage.integration.mjs).
Inspect `src/showroom/menus-preview.tsx` and its matching fixtures.
