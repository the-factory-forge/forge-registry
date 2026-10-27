# Implementation tasks

- [x] forge-registry: implement reservation types, validation and shared scheduling model.
- [x] forge-registry: implement PostgreSQL schema, migrations, transactions, links and notification delivery.
- [x] forge-registry: implement public booking, management, staff calendars and settings editors.
- [x] forge-registry: add English/French showroom, homepage discovery and integration docs.
- [x] forge-registry: register both items and rebuild generated artifacts.
- [x] forge-registry: run model, PostgreSQL, browser, build and repository checks.
- [x] forge-registry: verify a disposable shadcn consumer install and example adapters.
- [x] forge-spec: validate this change and report results; sync completed requirements before archival.

## Verification

- 47 repository unit tests, including scheduling, DST, policy snapshots and management signatures.
- Disposable PostgreSQL 18 integration: competing bookings, automatic resource assignment, idempotency, stale edits, guest restrictions, fresh authorization, durable notifications and archival.
- Five production-browser journeys: booking, guest management, staff actions, filters, all calendar views, settings, English/French, keyboard input, mobile, themes and failure/loading/empty states.
- Official shadcn install into a disposable consumer; consumer typecheck/build, installed SQL/server booking/email smoke test and calendar CSS verified.
- Registry generation/check, formatting/lint fixes, typecheck, pnpm check and production build passed. Nine existing accessibility lint warnings remain outside Reservations.
- Requirements synced into openspec/specs/reservations/spec.md. No customer-site install or deployment performed.

## Year view follow-up

- [x] forge-registry: add the rolling year table, bounded reads, translations and day navigation.
- [x] forge-registry: verify leap dates, filtering, keyboard navigation, themes, mobile and clean consumer installation; rebuild distribution.
- [x] forge-spec: validate and sync the year-view requirement.

Year follow-up verification passed: 48 unit tests, seven production browser journeys, typecheck, repository checks and build, generated-source consistency, clean consumer install/build and browser rendering, and strict OpenSpec validation. Existing lint warnings are unchanged.

## Stay mode extension

- [x] forge-spec: extend the shared contract for installation mode, overnight rules and stay presentation.
- [x] forge-registry: add stay policies, date-range availability, closure validation and mode persistence.
- [x] forge-registry: reuse booking/management forms and calendars; add apartment previews and translations.
- [x] forge-registry: verify appointment/stay units, real PostgreSQL, browser journeys and consumer installation.
- [x] forge-registry: update integration docs, regenerate distribution and run format/lint/type/check/build.
- [x] forge-spec: validate OpenSpec, review links and run diff checks.

Stay verification passed: 51 repository unit tests, ten reservations browser journeys, and real PostgreSQL appointment/stay integration tests. A disposable shadcn consumer passed type checking, production build, installed migration/server/email smoke checks, both booking modes, all five calendar views and stylesheet checks. Formatting/lint fixes, registry generation/check, type checking, pnpm check, production build and strict OpenSpec validation passed. Nine existing lint warnings remain. No live consumer was updated or deployed.
