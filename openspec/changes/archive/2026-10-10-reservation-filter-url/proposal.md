## Why

Reservation calendar filters are lost on reload and cannot be shared through a URL.

## What changes

Expose optional controlled filters in the portable calendar and bind resource,
service and status to validated showroom query parameters. Remove defaults when
staff select All. This is reusable calendar behavior without site-specific rules.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `reservations`: Restore staff filters from URLs and omit defaults.

## Impact

The owning OpenSpec root is forge-spec. forge-registry owns implementation,
showroom routing, documentation, tests and generated source. Its manifest already
ships the affected files. l-aspic is a recorded consumer; adoption remains a
follow-up. No host routes, persistence, dependencies or deployments change.
