## Why

Plugin actions currently wait for callbacks before updating their visible data.
Users need immediate feedback with rollback if a request fails.

## What changes

Use TanStack Query mutations for predictable data changes across the seven data
plugins. Preserve callback APIs, drafts, confirmation/retry controls, server
validation and completion signals for actions requiring server-issued results.

## Capabilities

### Modified capabilities

- `plugins`: Optimistic mutation behavior, rollback and host integration.

## Impact

`forge-registry` owns this change. `forge-registry` owns the shared mutation utility,
plugin integrations, showroom request delays, docs, tests and regenerated shadcn
items. A disposable consumer install verifies distribution. No production host,
server schema, migration, deployment or unrelated template change is included.
