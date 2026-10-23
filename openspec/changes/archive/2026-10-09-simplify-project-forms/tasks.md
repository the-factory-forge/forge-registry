## Implementation

- [x] forge-registry: simplify shared project forms, payloads, labels and unused picker.
- [x] forge-registry: update showroom ownership callbacks and affected tests.
- [x] forge-registry: document the skeleton scope in AGENTS.md and plugin guides.
- [x] forge-spec: reconcile the Projects module requirement and plugin definition.

## Validation and transfer

- [x] forge-registry: format, lint, rebuild registry, run unit/type/check/build checks.
- [x] forge-registry: verify Projects and Customers browser flows in both themes and sizes.
- [x] forge-registry: verify a temporary shadcn consumer install and typecheck.
- [x] forge-spec: validate OpenSpec and review links.
- [x] both repositories: transfer only the task diff, preserve existing edits, recheck and remove worktrees.

Existing customer deployments require a separately reviewed source update and adapter migration.

Validation passed: 66 unit tests, 14 Projects/Customers browser tests using installed
Chrome, registry generation/check, typecheck, check, build, a shadcn consumer
install/typecheck and strict OpenSpec validation. Existing lint warnings remain.
