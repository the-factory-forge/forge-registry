# Validation

- Registry unit suite: 86 passed.
- PostgreSQL/MinIO storage suites: 15 Drive, 11 Blogs and the Menus integration passed, including browser XHR, legacy pending uploads, renamed/duplicated reads and cleanup.
- Regression assertions failed on the old extensionless keys before implementation.
- Registry format, lint fixes, typecheck, check, JSON validation and production build passed. Lint and build retain existing warnings.
- Initial implementation: pinned shadcn installed both companions and their dependencies in a disposable consumer; strict TypeScript and exact changed-source comparisons passed. The filename-field correction changes no file targets, dependencies or schema; its regenerated item contents match the corrected source.
- Focused OpenSpec change passes strict validation. Full-repository strict validation reports pre-existing long-requirement warnings and unrelated change issues; these remain outside scope.
- Transferred changes were rechecked in the original checkouts; pre-existing spec edits remain intact.
- No live bucket objects, customer source, customer database or deployment was changed. Existing Drive hosts must apply the additive migration and deploy writers and maintenance workers together.

## Filename-field clarification

The owner chose to always rebuild the type from upload context. Underscores join
words within a field; hyphens separate asset name, type and supplied modifiers.
Regression cases use `the_corner-logo_mark-white.png`,
`the_corner-icon-filled-white_bg.webp` and `tc_ai-logo_black.svg`. The initial
helper failed these cases by flattening underscores and appending a second type.
The corrected helper replaces that type and preserves modifiers except `original`.

The 86 unit tests, 11 Blogs and 15 Drive storage checks pass with the corrected
fields, including signed upload/download paths and legacy cleanup. Formatting,
lint, types, production build and focused strict OpenSpec validation pass.
The full consumer install and Menus integration were performed for the initial
implementation; no dependency, schema or caller API changed in this correction.
