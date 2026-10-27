## Implementation

- [x] forge-registry: sort final public choices in `registry/components/plugins/menus/label-presets.ts` with locale-aware comparison.
- [x] forge-registry: update `docs/menus.md` and unit/browser checks for English and French alphabetical order.
- [x] forge-registry: format, lint, regenerate distribution, run tests/types/check/build and compile a refreshed disposable consumer.
- [x] forge-spec: validate and reconcile the modified Menus requirement.

## Verification evidence

- All 59 unit tests passed, including English/French name ordering, accented and custom labels, supplied-order independence and preservation of item-label order.
- All seven production Menus browser tests passed. The public filter journey asserts Gluten/Milk and Vegan/Vegetarian in English, and Gluten/Lait and Végétalien/Végétarien in French, alongside existing filtering, staff-catalog and narrow-layout checks.
- Formatting, lint fixes, official registry generation, JSON validation, type checking, combined checks and the production build passed. Nine pre-existing accessibility warnings remain outside Menus.
- Official shadcn installation refreshed a disposable Menus consumer. Its TypeScript compilation passed and all Menus source files match generated and installed copies.
- The French in-app preview was inspected with the requested alphabetical filter choices. Strict change validation passed.
- Existing consumers adopt the behavior by refreshing their installed source. No migration or live database change is required.
