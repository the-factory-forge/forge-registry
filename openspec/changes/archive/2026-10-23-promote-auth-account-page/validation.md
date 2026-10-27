# Validation — 2026-10-11

- Registry isolated worktree: build, typecheck, registry:check, registry:sync,
  format, lint:fix and check passed. All 81 baseline unit tests and all seven
  account/auth browser tests passed; mobile table overflow found and corrected.
- Original registry checkout after transfer: build, typecheck, registry:check,
  all 84 unit tests (including existing mailing changes), format, lint:fix and
  check passed. Existing unrelated lint warnings remain. Mailing/reservation
  source and generated routes/items were preserved. Task changes were left
  uncommitted at that handoff.
- Real shadcn 4.21.4 install with the complete local namespace succeeded in a
  disposable consumer; its emitted source type-checks with TypeScript extension
  imports enabled. The template retains its cn/Link adapters and dependency versions.
- Template: formatting and lint/type checks passed; four production browser tests
  passed for profile/password changes, onboarding, keys, older OAuth sessions,
  impersonation and ownership guards. Four locales and mobile/desktop light/dark
  states passed; screenshots were reviewed. Existing unrelated lint warnings remain.
- The new OpenSpec change validates. The full strict OpenSpec check reports 25
  passing items and one existing failure: `show-employee-website-visibility` has
  no delta. That unrelated change was not modified. Relative document links and
  Git diff whitespace checks passed.

No provider OAuth redirect or external email delivery was tested; local fixtures
and fake transport were used. No live migration, registry publication, other-site
rollout or deployment occurred. The preceding template Security migration still
requires normal deployment application if absent there.

## TC adoption follow-up

- TC: required format/lint with type checks and eight focused unit tests pass.
  Three production browser tests pass for custom profile persistence, all five
  routed tabs with reload/Back/Forward, avatar crop cancellation, HR confirmation
  cancellation, denied HR access, restricted key creation with owned-key deletion,
  encrypted key storage, expired/revoked display and older GitHub sessions. Narrow/
  wide Security screenshots cover both themes. Final test-only corrections reused
  the unchanged production build; no backend code was changed.
- Registry: 84 unit and eight account/auth browser checks pass, including default
  profile behavior and host content without creation permission. Build, format,
  lint, generated distribution, typecheck and check pass. The original checkout
  matched the verified worktree; task changes were left uncommitted at that handoff,
  and the temporary worktree/branch were removed. Concurrent unrelated release
  work was preserved. Existing unrelated registry lint warnings remain.
- A real shadcn 4.21.0 installation through the complete local namespace succeeds
  and its source type-checks. All eight adopted TC files match that installed source
  after documented alias/extension rewrites and formatting. Package and namespace
  configuration remain unchanged. TC records the partial scope and retained inputs
  in `docs/registry-sync.md` and its install manifest.
- The Auth change passes strict OpenSpec validation, consumer YAML parses and
  relative links/whitespace checks pass. The full check retains the unrelated
  `show-employee-website-visibility` failure (25 pass, one fail).

The isolated local `tc_shared_auth_e2e` database received existing migrations only.
No live database, provider OAuth, email delivery or S3 upload was used. No new schema
migration, deployment or other-site refresh is part of this TC adoption.

## Account tabs and email follow-up — 2026-10-22

- Registry formatting, lint fixes, standalone typecheck, combined check and
  production build pass using the pinned local executables. The worktree package
  runner attempted an unnecessary dependency reinstall, so the corresponding
  package-script commands were run directly against copied installed dependencies.
- All 89 unit tests and 11 focused account/auth browser tests pass. Email checks
  now attempt simultaneous submissions and another submission while pending,
  verify callback addresses, retry and later requests, retain the original email,
  and check the visible required marker and native semantics. Tab tests edit the
  existing account Name field, switch by pointer/keyboard, verify immediate hidden
  plugin mounting and verify unmounting on plugin removal.
- Mobile (390px) and desktop (1440px) email/plugin captures were inspected in both
  themes with no horizontal overflow. The scoped Impeccable detector reports no
  findings. Existing feedback-position assertions continue to pass.
- Official shadcn output was regenerated; every Auth file's embedded content
  matches source. Ownership/reverse-dependency assertions retain Auth, sidebar
  and shell. This follow-up changes no item path or dependency; a fresh consumer
  installation was not repeated.
- The Auth change passes strict OpenSpec validation. Markdown/YAML formatting,
  local documentation links and diff whitespace pass. At that validation, the
  full strict check had the same 15 failed items as the original checkout,
  primarily existing long requirement warnings; the follow-up added no failed item.

The registry follow-up is merged into `main` at
`f051fbb9b1027f7b39bae87fb65bfa625b9f9e97` (PR 18). The shared-spec follow-up is
committed at `75d3a5bc51bae4bb23914719507f1486c87f220f`. No consumer source,
provider endpoint, email delivery or deployment was changed or verified by this
follow-up. Consumer adoption and deployment remain unverified.

## Status reconciliation — 2026-10-22

OpenSpec 1.13.2 passes the focused Auth change and all 28 items with
`--all --strict --no-interactive`; existing informational findings remain.
The updated Markdown and YAML entry pass formatting, YAML parsing, local-link
and diff whitespace checks. Unrelated YAML formatting differences are preserved.
Application tests and consumer/deployment checks were not repeated for this
documentation update.
