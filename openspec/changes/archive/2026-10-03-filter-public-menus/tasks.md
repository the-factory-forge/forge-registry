## Implementation

- [x] forge-registry: add filters and optional defaults in `registry/components/plugins/menus/public.tsx` and `labels.ts`.
- [x] forge-registry: update the existing showroom, homepage listing, manifest and `docs/menus.md`.
- [x] forge-registry: add combined-selection, empty/reset, keyboard and translation coverage in `tests/menus.browser.mjs`.
- [x] forge-registry: run formatting/lint fixes, registry generation/check, unit tests, typecheck, check and build.
- [x] forge-registry: verify menu browser journeys and visually inspect narrow light/dark states.
- [x] forge-registry: install generated Menus in a disposable shadcn consumer and check installed source.
- [x] forge-spec: validate this change, reconcile the Plugins requirement and archive with verification evidence.

## Verification

Passed `pnpm format`, `pnpm lint:fix`, `pnpm registry:sync`, `pnpm registry:check`,
`pnpm test` with 53 tests, `pnpm typecheck`, `pnpm check` and `pnpm build` in
forge-registry. The four Menus browser tests passed against both the development
showroom and production build. Visual inspection covered 390px light/dark menu
filters; SSR retained both initial dishes and the filter controls. Nine existing
lint warnings remain outside the changed Menus code.

A disposable consumer installed `@forge/menus` through the official pinned shadcn
CLI, including all 21 declared/transitive source files. Installed source passed
TypeScript and Vite production build. Browser checks passed combined filtering,
reset, legacy label object compatibility, 320px layout, keyboard focus, enabled
and disabled cursors, and selected-control colors with system and explicit
light/dark themes using the consumer's own small theme. No showroom stylesheet
was imported. The temporary namespace was restored to the published URL.

Strict OpenSpec validation passed for this change and all active shared specs.
No database schema or service behavior changed. Terminal60's existing adapter was
inspected; production consumer updates and deployment remain outside this request.
