## Implementation

- [x] forge-registry: prune default entries and unused icons, document retained choices, and update unit/browser coverage.
- [x] forge-registry: format, lint, regenerate endpoints and run registry/type/check/unit validation.
- [x] forge-registry: verify the build, browser states and disposable consumer install.
- [x] forge-spec: validate, reconcile the Plugins requirement and archive with verification evidence.

## Verification evidence

- Formatting, lint fixes, official registry generation, JSON validation, typecheck, `pnpm check` and build passed. Nine existing accessibility warnings remain outside Menus.
- All 55 unit tests passed. The five Menus browser tests passed against development and production builds.
- The updated official shadcn install passed TypeScript compilation in a disposable consumer. All eight Menus files match source, generated output and the installed copies.
- Visual review confirms the shorter filter catalog, retained semantic badges and usable narrow layouts. The remaining IDs and assigned dish labels are unchanged.
- The strict change validation passed before reconciliation and archive.
