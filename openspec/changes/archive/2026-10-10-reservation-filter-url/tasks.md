## Implementation

- [x] forge-registry: Add controlled filters in registry/components/plugins/reservations/admin.tsx and types.ts.
- [x] forge-registry: Bind validated search values in the reservation route and showroom adapter.
- [x] forge-registry: Document integration and add URL/browser-history regressions.
- [x] forge-spec: Update Reservations and Plugins contracts and record l-aspic adoption as pending.
- [x] forge-registry: Format, lint, regenerate public/r, typecheck, check, build and run reservation regressions.
- [x] forge-spec: Validate OpenSpec and transfer reviewed task diffs to original checkouts.

## Verification

The original registry checkout passed format/lint/type checks, registry generation
and JSON validation, all 72 unit tests and its production build. Existing lint
warnings remain. The worktree passed all 13 reservation browser tests, including
URL/history/default omission and malformed parameters; the transferred change was
also checked against the original checkout's production build. A concurrent build
replaced its assets during the last settings test, so the suite was rerun against
a fixed copy of the original build. All 17 browser tests passed in that final run.

The new change passes strict OpenSpec validation. Whole-repository strict
validation still reports existing long-requirement warnings in other requirements
and changes. No database or consumer installation was run: persistence and the
item's files/dependencies are unchanged. l-aspic adoption and deployment remain
unverified. All transferred edits remain uncommitted.
