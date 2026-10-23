## Why

Guests opening a private reservation page need a visible way back to booking,
including when their link has expired. L’Aspic requested the arrow beside its title.

## What Changes

- Add optional host-owned back navigation to the shared management heading.
- Adopt it in L’Aspic and the showroom using existing translated labels and links.
- Keep booking rules, private tokens, storage and customer theme unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reservations`: accessible back navigation from private management.

## Impact

This forge-registry change owns the plugin contract. forge-registry owns the UI,
showroom, guide and generated reservations item. l-aspic owns its booking route
and router adapter. No dependency, migration or authentication changes are needed.
