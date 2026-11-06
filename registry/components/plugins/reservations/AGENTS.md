# Reservations

Reservations supports appointments or overnight stays in one host-selected mode.
Read the [integration guide](../../../../docs/reservations.md) and the dedicated
[Reservations contract](../../../../openspec/specs/reservations/spec.md), which
owns scheduling details beyond the Plugins overview.

## Logic and ownership

- `model.ts` owns validated policies, availability and date/time calculations.
  Appointments fit duration plus preparation/cleanup within working intervals;
  stays occupy one resource for the full buffered arrival-to-checkout interval.
  Temporal handles business-local dates and daylight-saving transitions; local
  night counts are not elapsed 24-hour periods.
- `public.tsx` provides booking and private management; `admin.tsx` provides staff
  views and creation; `settings.tsx` edits resources/policies. `ui.tsx` shares the
  month date picker with booking and staff Month view; `year.tsx` handles Year.
  URL filters/navigation belong to the host adapter.
- `server/service.server.ts` rechecks availability under the scheduling lock and
  commits versioned, idempotent writes. Pending and confirmed reservations occupy
  capacity. Saved policy snapshots continue to govern existing reservations.
- `server/links.ts` signs and validates reservation-specific management links.
  Staff access remains separately authorized. Notification rows commit with the
  booking mutation; a host-run worker sends them in version order with leases and
  retries. Mailing handles rendering/transport, not reservation persistence.

## Change boundaries

Mode is installation configuration, not an editable per-service choice. Preserve
`MODE_MISMATCH` handling and reviewed migration requirements. Recompute availability
on writes even if a preceding read showed an open slot.

Guest links do not bypass cancellation cutoffs or policy checks. Email failure
does not undo a booking; delivery is at least once with stable provider idempotency
keys. Explicit staff Refresh resets selection/rescheduling; ordinary late results
must not affect replacement views. Keep optional month availability and daily
fallback compatible for existing appointment adapters.

## Checks

Use [model tests](../../../../tests/reservations.test.mjs),
[browser flows](../../../../tests/reservations.browser.mjs) and
[month calendar tests](../../../../tests/reservation-month.browser.mjs).
Scheduling, links or notification writes need the
[storage harness](../../../../tests/reservations-storage/storage.integration.mjs).
Inspect `src/showroom/reservations-mock.ts` and the preview when changing contracts.
