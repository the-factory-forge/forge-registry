## Implementation

- [x] forge-registry: prune the catalog and icons, update documentation and catalog checks.
- [x] forge-registry: format, lint, regenerate, run registry/unit/type/check/build and browser validation.
- [x] forge-registry: verify the consumer install and visually review the simplified filters.
- [x] forge-spec: validate, reconcile the Plugins requirement and archive with evidence.

## Verification evidence

- Formatting, lint fixes, official registry generation, registry JSON validation, typecheck, `pnpm check` and build passed. Nine existing accessibility warnings remain outside Menus.
- All 55 unit tests and five production Menus browser tests passed.
- The updated official shadcn install passed consumer TypeScript compilation. All eight Menus files match source, generated output and installed copies.
- The default filter panel now displays the common dietary choices with retained icons and semantic colors. Browser coverage verifies narrow French layouts, both themes and existing filter interactions.
- The strict change validation passed before reconciliation and archive.
