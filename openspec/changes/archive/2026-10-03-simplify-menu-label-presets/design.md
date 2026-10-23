## Context

Menus uses one preset catalog for default public filters and showroom taxonomy. Host-supplied labels remain independent.

## Decision

Delete the eight default entries and their unused icon mappings. Keep the remaining IDs stable. Preserve the existing filter helper and custom-label behavior.

## Compatibility

The change affects default choices and demo taxonomy. It does not remove assigned labels from host data or alter filtering semantics, props, schemas or dependencies. Consumers adopt the generated source through their existing shadcn workflow.

## Validation

Check the exact retained dietary defaults, both translated filter groups, existing filter interactions, registry generation, application build and a disposable consumer install.
