## Implementation

- [x] forge-registry: filter public options in `registry/components/plugins/menus/label-presets.ts` and retain staff catalog behavior.
- [x] forge-registry: update `docs/menus.md` and the existing unit/browser journeys.
- [x] forge-registry: format, lint, regenerate distribution, run types/check/build and refresh a disposable consumer install.
- [x] forge-spec: validate and reconcile the modified Menus requirement.

## Verification evidence

- All 58 unit tests passed. The public-filter check covers unused defaults and overrides, hidden items, empty menus, host label IDs and custom labels; the complete preset catalog check remains unchanged.
- All seven production Menus browser tests passed. The filter journey confirms only two assigned allergens and two assigned dietary choices appear, choices remain available after filtering, all 19 labels remain in the editor, and adding/removing a visible assignment changes its public choice. English/French, keyboard interaction and narrow layouts in both themes are covered.
- `pnpm format && pnpm lint:fix`, official registry generation, `pnpm registry:check`, `pnpm typecheck`, `pnpm check` and `pnpm build` passed. Nine existing accessibility warnings remain outside Menus.
- Official `shadcn add @forge/menus --yes --overwrite` refreshed a disposable consumer. Its TypeScript compilation passed and all Menus files match source, generated output and installation.
- The current French public preview was inspected with only Lait, Gluten, Végétarien and Végétalien filters available.
- Strict change validation passed. No schema change or migration is required; live consumers adopt the update by refreshing their installed source.
