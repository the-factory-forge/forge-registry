# Persistent bulk delete controls

## Why

Keep table actions discoverable and visually stable when selection is empty, using the same muted disabled colors as pagination.

## What Changes

Bulk delete stays visible and disabled without selected rows in plugin tables, including agent keys. Existing permissions, confirmation and deletion callbacks remain unchanged.

## Capabilities

- Modified: `plugins` — agent-key and plugin-table selection requirements.

## Impact

Owning root: forge-spec. Implementation and generated distribution: forge-registry. This is shared table behavior; consumer installation and deployment remain follow-ups already recorded for table selection. No API, dependency or schema changes.
