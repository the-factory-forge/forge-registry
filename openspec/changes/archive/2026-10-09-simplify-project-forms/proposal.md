## Why

The shared project forms contain Website URL, Owner and Assignee editors that
make the website-generation skeleton too specific. Keep those workflows in hosts.

## What changes

- Remove these three inputs and their selector/directory requirements from shared forms.
- Narrow form callbacks to name, status and description. Preserve read-only metadata.
- Document host-owned creation context and metadata-preserving updates.
- Require a scope check in registry AGENTS.md before adding site-specific behavior.

## Capabilities

### Modified capabilities

- `plugins`: basic Projects forms and host-owned ownership/assignment workflows.

## Impact

The owning OpenSpec root is forge-spec. Implementation, tests, showroom adapters,
AGENTS.md and generated distribution change in forge-registry. Existing consumers
must adapt callbacks and remove old form directory props on their next source
update. This task does not modify or deploy customer websites or migrate data.
