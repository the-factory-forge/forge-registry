## Verification

- forge-registry: pinned pnpm 12.8.1 scripts for format, lint fixes, registry generation/JSON validation, TypeScript, combined check and production build pass. Existing lint warnings remain.
- All 88 unit tests and all eight account browser journeys pass against the production build. Coverage includes keyboard selection, none/mixed/all state, cancellation, duplicate clicks, disabled pending actions, partial failures and retry, unavailable metadata and existing account flows.
- Desktop (1440px) and mobile (390px) table and confirmation captures were inspected in light/dark. Table geometry stays stable during selection and the page has no horizontal overflow; the wide table retains its existing horizontal scroll on mobile.
- The Impeccable detector reported no findings for the changed UI files.
- The new OpenSpec delta passes strict validation. Full forge-spec validation retains 15 pre-existing strict failures, confirmed against the unchanged original checkout; no new failing item remains.
- Auth still ships the changed source/labels through its existing manifest. Reverse dependencies are intranet-sidebar and intranet-shell. No dependencies or install targets changed; a fresh shadcn consumer install was not rerun.
- Recorded consumer key adapters were read and await per-key deletion plus query invalidation. Consumer source, translations, server authorization and deployment were not changed or runtime-tested.

The original checkouts retain the task changes uncommitted. Registry JSON, types, combined check and all 88 unit tests pass after transfer; source and generated Auth content match the verified worktree. The new spec delta also passes in the original checkout.
