## Implementation

- [x] forge-registry: add `label-presets.ts`, `label-badge.tsx`, exports, public filter integration and staff item badges.
- [x] forge-registry: seed the showroom labels, register shipped files and update the guide/homepage.
- [x] forge-registry: add catalog and badge/filter browser coverage.
- [x] forge-registry: format, lint, regenerate endpoints and run registry/unit/type/check/build validation.
- [x] forge-registry: run menu browser tests and visually review narrow light/dark states.
- [x] forge-registry: install/typecheck the updated Menus source in a disposable consumer.
- [x] forge-spec: validate, reconcile the Plugins requirement and archive with verification evidence.

## Verification evidence

- `pnpm format && pnpm lint:fix`, `pnpm registry:sync`, `pnpm registry:check`, `pnpm typecheck`, `pnpm check` and `pnpm build` passed. Lint retains nine existing accessibility warnings outside Menus.
- `pnpm test`: 55 passing unit tests.
- Menu browser suite: five passing tests against the development server and five against the production build.
- Narrow French filters and dish badges reviewed in light and dark themes; no horizontal page overflow.
- Official `shadcn add @forge/menus --yes --overwrite` install in a disposable consumer passed TypeScript compilation. All eight Menus source files matched the generated endpoint and installed files.
- Preset changes preserve assigned dish labels and custom host IDs; no database mutation or migration runs during source installation.
- `openspec validate preset-menu-labels --strict --no-interactive` passed; official archive reconciled the Plugins requirement.
