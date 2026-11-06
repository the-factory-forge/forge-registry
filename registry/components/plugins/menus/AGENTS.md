# Menus

Menus manages translated restaurant items, taxonomy and public/print presentation.
Read the [integration guide](../../../../docs/menus.md) and
[Menus requirements](../../../../openspec/specs/plugins/spec.md#requirement-menus-plugin).

## Logic and ownership

- `admin.tsx` composes staff pages. `editor.tsx`, `use-menu-items.ts` and
  `use-categories-and-labels.ts` own distinct editor, list and taxonomy lifetimes.
  Replacing the client starts a new session; departed completions cannot update it.
  Saving snapshots the editor and preserves typing made while the save is pending.
- `model.ts` validates inputs and builds menu views. Prices use integer minor
  units; the host supplies currency. Missing translations fall back to the base
  locale for the whole entity. Hidden items leave public views; sold-out items stay.
- `public.tsx` applies allergen exclusions and required dietary labels.
  `print.tsx` handles A4/A5 output. `label-presets.ts` owns shared label/icon data;
  customer menu copy and visual branding remain host-owned.
- `server/service.server.ts` checks authorization, versions and taxonomy relations.
  Reordering validates the complete item/version list and commits positions
  atomically without changing categories. Stale/missing/duplicate rows reject it.
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
