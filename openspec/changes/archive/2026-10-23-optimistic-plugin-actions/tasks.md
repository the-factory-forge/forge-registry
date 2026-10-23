## Implementation

- [x] forge-registry: Add the shared TanStack Query mutation utility and dependency.
- [x] forge-registry: Apply predictable optimistic mutations across the seven data plugins.
- [x] forge-registry: Preserve errors, drafts, confirmation and duplicate-submission guards.
- [x] forge-registry: Add showroom delays, rollback tests and host integration documentation.
- [x] forge-spec: Reconcile the plugin definition and shared optimistic behavior contract.
- [x] forge-registry: Regenerate distribution and validate a disposable consumer install.
- [x] forge-registry: Complete unit, browser, format, lint, type and build checks.
- [x] forge-spec: Validate specs and review links; transfer only task diffs to original checkouts.

## Validation

The original forge-registry checkout passes registry validation, formatting/lint
checks, type-checking, 70 unit tests, the production build and all eight delayed
optimistic-action browser tests. The seven existing plugin browser suites and
focused reruns cover successful reconciliation, errors, navigation and permissions.
Merged Drive pagination, rename and restoration checks pass. All seven plugins
install and type-check in a disposable shadcn consumer.

This OpenSpec change passes strict validation. Full shared-spec validation still
fails on the same eleven pre-existing items; the original checkout was checked
before transfer to establish that baseline. The existing plugin-table layout test
also fails against the original baseline during responsive search transitions.
The 176 lint warnings are pre-existing. No production deployment, database/storage
integration run or consumer-site update was performed.

Task diffs were transferred uncommitted to the original branches. Existing edits,
including concurrent Drive pagination and toast changes, were preserved.
