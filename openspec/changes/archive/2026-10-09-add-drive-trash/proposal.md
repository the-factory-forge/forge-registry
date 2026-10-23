## Why

Drive deletion is currently permanent. Business files need a bounded recovery
window that preserves folder contents and prevents accidental overwrites.

## What Changes

- Add opt-in trash with 30-day default retention, restoration and explicit purge.
- Offer Undo in the trash confirmation toast with retry and conflict recovery.
- Preserve custom adapters without trash and permanent `deleteEntry` behavior.
- Include trash in the initial PostgreSQL schema and extend durable maintenance cleanup.
- Keep host authorization and Menus image guards authoritative.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugins`: Drive trash, restoration, retention, permissions and compatibility.

## Impact

Owning OpenSpec root: forge-spec/openspec/changes/add-drive-trash.
Implementation: forge-registry Drive UI/server, showroom, tests, item manifest,
generated output and integration guides. Hosts initialize the database and opt in explicitly.
No website currently runs Drive, so no existing database upgrade is needed.
No customer deployment, new plugin or new runtime dependency.
