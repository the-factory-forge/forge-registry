## Context

The shared preset catalog supplies public defaults and showroom taxonomy. Hosts can supply custom labels independently.

## Decision

Delete the four specialized entries and unused icon mappings. Keep the remaining IDs stable and preserve existing filter behavior and host labels.

## Compatibility

Only default choices change. Existing assigned host labels remain available with the existing generic badge fallback. No database migration or consumer configuration changes are required.

## Validation

Verify the retained default catalog, translated filters and existing interactions; run registry generation, unit/type/check/build validation and a disposable consumer install.
