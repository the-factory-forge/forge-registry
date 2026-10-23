## Why

Staff expect Cmd+Enter or Ctrl+Enter to save a short modal form, including Drive's
New folder dialog.

## What Changes

- Add the platform save shortcut to existing plugin create/edit modal forms.
- Preserve each form's validation, disabled states and mutation handling.
- Ship a shared handler with the affected registry items and document its scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugins`: Consistent modal form submission shortcuts.

## Impact

forge-spec owns this shared change. forge-registry owns the implementation,
distribution, guide and regression checks. Consumer updates and deployments are
outside this task; consumers receive the behavior after refreshing installed source.
