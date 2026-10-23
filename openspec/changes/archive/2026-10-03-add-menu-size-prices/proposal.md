# Add menu size prices

## Why

Restaurants need different prices for pizza sizes and drink volumes. Menu items
currently expose one price, so staff cannot maintain or display those options.

## What Changes

- Add optional translated sizes with individual prices to menu items.
- Let staff add, edit and remove sizes in the existing item editor.
- Show accessible size-and-price choices on public dishes and update the selected price.
- Persist sizes through an incremental migration, preserving existing single-price items and older-client edits.

## Impact

- Affected specification: `plugins`, Menus plugin requirement.
- Implementation belongs in forge-registry's existing Menus UI, model, storage companion, demos and tests.
- Hosts apply the shipped migration through their own workflow; no production database or customer checkout changes are part of this task.
