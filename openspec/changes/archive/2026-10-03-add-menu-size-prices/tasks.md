## Implementation

- [x] Add validated optional sizes and localized public projection.
- [x] Add staff size editing and accessible public size/price choices.
- [x] Add storage schema/service support and an incremental migration.
- [x] Update module distribution, demos and integration documentation.

## Validation

- [x] Run unit, production browser and disposable storage/restart checks.
- [x] Format, lint, regenerate the registry, check types and build.
- [x] Install the official registry output into a consumer and compile it.
- [x] Review narrow layouts and both themes, then reconcile the shared specification.

## Verification evidence

- All 58 unit tests and all seven production Menus browser tests passed. The size journey covers creation, translated names, exact-price validation, failed-save draft retention, keyboard selection, per-size price display, filter independence and clearing sizes on mobile in both themes.
- The disposable PostgreSQL/S3 suite passed, including defaults on existing rows, migration reapplication, JSON array shape enforcement, size validation, create/read/save/public projection, older clients preserving sizes and explicit clearing.
- The restart phase passed with both saved size prices and the first-size default intact. Test services and volumes were removed afterward.
- Formatting, lint fixes, official registry generation, JSON validation, type checking, combined checks and the production build passed. Nine pre-existing accessibility warnings remain outside Menus.
- Official shadcn installation into a separate consumer and its TypeScript compilation passed. All nine UI files and seven storage files match source, generated output and installed copies.
- The French public size chips were inspected visually and selecting Grande updated the header to 34,50 CHF. The pizza browser journey also saved a review screenshot.
- Strict change validation passed. Host adoption still requires installing updated source and applying the shipped migration through the host workflow; no live database was migrated.
