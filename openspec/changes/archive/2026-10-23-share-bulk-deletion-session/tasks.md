## Implementation

- [x] Deepen table selection into the shared deletion-session owner and retire coordination methods.
- [x] Adopt it in Auth and guard Drive preview-token writes; preserve host callbacks and special Employee retention deletion.
- [x] Update manifest, glossary, plugin requirements, guides and coordinated adoption handoff.
- [x] Record pending consumers in Forge Spec without editing sites.

## Verification

- [x] Verify controlled lifecycle tests and existing table/Auth/Drive showroom journeys, including narrow layouts and themes.
- [x] Format, lint, regenerate distribution, run registry checks, unit tests, type checks and build.
- [x] Verify a real shadcn installation and installed source typing.
- [x] Validate owning OpenSpec and consumer records and review diffs.

## Evidence

Eight controlled browser scenarios cover delayed previews, scope changes, original
callback context, remounts, unmounts, partial failure and stale Drive tokens. All
53 existing table/Auth/Drive showroom scenarios pass; the 22 affected table/Auth
scenarios were rerun successfully against the final build. Layout assertions cover
both themes and mobile/desktop; Auth mobile dark and Drive desktop confirmation
captures were inspected.

All 108 unit tests pass. Formatting, lint fixes, registry generation/parsing,
typecheck, combined check and production build pass. The combined check reports
no warnings. Strict OpenSpec validation passes for Registry and Forge Spec.

A disposable consumer installed Auth and Drive using shadcn 4.22.1 from rebuilt
local endpoints. All three changed source modules match, strict TypeScript passes,
and TanStack Query is installed transitively. The controlled fixtures use no Query
provider. Relative documentation links resolve. Consumer upgrades, database/storage
integration runs and deployment remain outside this UI refactor.
