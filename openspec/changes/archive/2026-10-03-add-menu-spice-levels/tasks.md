## Implementation

- [x] forge-registry: add dish spice types, normalization, badges, editor choices and public projection; remove the Spicy default label.
- [x] forge-registry: extend storage schema/service and Better Auth registration; ship an incremental SQL upgrade.
- [x] forge-registry: register files and update showroom, guides and meaningful unit/browser/storage coverage.
- [x] forge-registry: format, lint, rebuild registry and pass unit/type/check/build validation.
- [x] forge-registry: verify browser states and disposable database upgrade/save/restart behavior.
- [x] forge-registry: verify updated UI/storage installation and consumer typecheck.
- [x] forge-spec: validate, reconcile the Plugins requirement and archive with actual evidence.

## Verification evidence

- `pnpm format && pnpm lint:fix`, official registry generation, JSON validation, `pnpm typecheck`, `pnpm check` and `pnpm build` passed. Nine existing accessibility warnings remain outside Menus.
- All 56 unit tests passed. All six production Menus browser tests passed, including levels one/two/three, clear, French labels and narrow layouts.
- The disposable PostgreSQL/S3 suite passed. It verifies old-row defaults, migration reapplication without resetting heat, range enforcement, create/read/save/public projection and an older client's omitted field.
- After restarting the disposable PostgreSQL container, the restart phase passed and retained the saved heat level. The test containers and volumes were removed afterward.
- Official `shadcn add @forge/menus-storage --yes --overwrite` installed both UI and storage. Consumer TypeScript compilation passed after adding Node types and enabling them in this server fixture. All nine UI files and six storage files match source, generated output and installed copies.
- The staff radio group was reviewed visually, including native keyboard selection and the one/two/three flame previews. Saving the demo level displayed the independent three-flame badge on the public page.
- Strict change validation passed before reconciliation. Live consumer source updates and migration application remain host adoption steps, outside this task.
