## Why

The showroom needs a stable local URL when other applications or Git worktrees
are running on the same machine.

## What changes

- Pin Portless as a development dependency and wrap `vp dev` with `portless run`.
- Document proxy setup, the direct-port bypass and browser test URLs.

## Capabilities

### New capabilities

- `showroom-development`: named development URLs with direct Vite access.

### Modified capabilities

None.

## Impact

Only the registry's development tooling and guides change. Registry items,
consumer dependencies and production startup remain unchanged.
