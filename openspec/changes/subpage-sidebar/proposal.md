## Why

Drive needs persistent navigation between folders and Trash beside its content.
Other page modules need the same local navigation without a second intranet shell.

## What Changes

- Extract the intranet sidebar navigation renderer and mobile hook for reuse.
- Add a portable subpage sidebar with grouped links and a mobile drawer.
- Use it in Drive for All files, a lazily loaded folder tree, and optional Trash.
- Add a discoverable showroom example, docs, tests and generated distribution.

## Capabilities

### New Capabilities

- `subpage-sidebar`: Navigation scoped to a page, including nested destinations.

### Modified Capabilities

None. Existing Drive client methods and intranet sidebar exports stay compatible.

## Impact

The owning root is forge-registry. Items affected are intranet-sidebar, Drive,
and the new sidebar-navigation and subpage-sidebar items. IntranetShell inherits
the shared renderer. Menus embeds Drive as its file picker. Recorded consumer
adoption is a follow-up: forge-template and existing sidebar hosts preserve their
routing/auth adapters; terminal60 preserves its Drive storage integration.
No customer site, server storage API, schema, favorites or sharing changes.
