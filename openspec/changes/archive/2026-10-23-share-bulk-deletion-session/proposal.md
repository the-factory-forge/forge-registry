# Share the deletion session

## Why

The shared table dialog and Auth key dialog coordinate the same deletion lifecycle
separately. Pending previews can also outlive a scope change and make stale targets
confirmable. One session owner makes those rules consistent and testable through
both dialogs.

## What Changes

- Move selection, confirmation targets, preparation, pending state and failure-only
  retries into the shared hook; keep host deletion callbacks and plugin props.
- Cancel unconfirmed sessions on scope change, while confirmed batches may finish
  across host refreshes. Stop later calls when the control unmounts.
- Reuse the lifecycle in Auth without optimistically hiding keys. Preserve key
  creation, secret display, Drive previews and Employee retention deletion.
- **BREAKING**: retire the hook's `setPending`, `delete` and `remove` methods and
  update registry callers together; document coordinated custom-caller adoption.
- Declare Auth's table-selection dependency and retain its existing optional
  TanStack Query provider behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugins`: shared deletion lifecycle, stale-preview cancellation and Auth unmount behavior.

## Impact

Registry owns source, generated output, tests, documentation and the delta for
`openspec/specs/plugins/spec.md`. Changed items are table-selection, auth and drive;
their reverse dependency closure and pending sites are recorded in
`docs/HANDOFF-bulk-deletion-session.md`. Forge Spec receives only a consumer-update
record. Customer upgrades, shared contract changes and deployment are outside scope.
