## Why

Renaming the current Drive location currently requires opening an arrow menu and a dialog. Clicking the title should allow typing directly in place.

## What changes

- Replace the current breadcrumb arrow with a keyboard-accessible inline title editor.
- Save on Enter or blur, cancel with Escape, and retain failed drafts and existing rename permissions.
- Preserve ancestor navigation and sidebar menus.

## Impact

forge-spec owns this change root and the shared Plugins requirement. forge-registry owns Drive UI, browser tests, guides and generated distribution. This reuses the existing folder client and optional host-record rename callback; no transport, schema or public prop changes are required. Terminal60 is the recorded direct consumer; drive-storage, menus and menus-storage inherit Drive. Its source refresh and deployment remain outside this task. Forge-template has no recorded Drive installation.
