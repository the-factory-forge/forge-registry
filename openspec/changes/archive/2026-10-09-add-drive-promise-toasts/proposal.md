## Why

Pending Drive operations need visible loading feedback before their outcome is
known. A spinner and one toast that updates in place follow the requested
[shadcn promise pattern](https://ui.shadcn.com/docs/components/base/toast#promise).

## What Changes

- Show loading, success and error states for uploads, downloads and toast Undo.
- Keep progress, retry/cancel controls and restore conflict recovery available.
- Align the toast header independently of upload details and respect reduced motion.

## Capabilities

- Modified: `plugins` (Drive operation feedback).

## Impact

Owning change root: forge-spec `add-drive-promise-toasts`. Implementation and
source distribution belong to forge-registry. Existing host adapters, permissions
and storage remain authoritative. No dependency, schema or transport change.
The restoring label has an English default and can be translated through the
existing labels prop.
