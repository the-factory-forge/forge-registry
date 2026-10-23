# Reservations design

## Existing patterns

Follow Menus for separate browser/server entrypoints and host-owned clients. Follow Blogs for JSON documents, Drizzle tables, additive migrations and transaction advisory locking. Reuse Base UI, Forge semantic tokens and ShowroomPreview. Do not depend on Drive or employee management.

## Decisions

One installation owns one business time zone. The host selects one installation mode. Appointment services have a fixed duration; stays have an arrival window, checkout time and night limits. Both retain their own policies. A reservation uses one eligible resource. Resource schedules contain weekly intervals and per-date replacement intervals, including empty closures. Snapshots preserve booking policy and time zone through later configuration edits.

PostgreSQL transactions serialize scheduling mutations per business. The service validates slots again while locked, checks optimistic versions, and binds unique creation request IDs to normalized payloads. Pending and confirmed reservations occupy their full buffered intervals. Customer rescheduling atomically replaces the original and returns manual-policy reservations to pending. Failed moves retain the original.

Use FullCalendar standard React views and its Temporal peer for IANA-zone calculations. Skip nonexistent times and distinguish repeated times. Calendar presentation consumes semantic tokens and ships required CSS. Hosts supply localization, transport, auth, rate limiting and CSRF protection.

Private links contain a signed reservation ID, expiry and revocation version. They authorize only guest management of that reservation. Notification jobs commit with booking changes, use stable delivery IDs and leased retry processing, and never roll back bookings on mail failures. Email providers should deduplicate by delivery ID; exactly-once email delivery is not promised.

## Delivery

forge-registry owns source, manifests, generated public/r endpoints, demos, docs and tests. A disposable consumer verifies portability. Installation includes SQL for explicit host review, never automatic migrations. This change installs nothing into forge-template or tc-website.

## Year view

The calendar uses a custom FullCalendar React view for twelve month rows, starting
at the viewed month. Date cells show filtered reservation counts and open Day view.
The view reuses Temporal and the current toolbar. It splits a year into at most nine
bounded list calls and deduplicates reservation IDs. No endpoint, migration or premium
calendar dependency is added. Keyboard movement, sticky month labels, English/French
labels and semantic colors apply to the year table.

## Stay implementation

Keep interval indexes and tables. Record installation mode in the settings JSON
on the first successful transaction; infer appointment for older settings/data.
Read-only catalog discovery does not initialize storage. Mode is returned separately
from editable business settings. Policy snapshots discriminate appointment/stay;
legacy appointment policies remain readable. Stay requests add departureDate and
never accept authoritative checkout instants. Resources add inclusive blockedDates;
stay availability checks the complete interval rather than each date independently.

Reuse the transaction lock, version checks, idempotency payload hashes, links and
outbox. New JSON fields need no DDL migration and installing source changes no data.
The existing date picker supplies range highlighting and direct date inputs. The
apartment showroom is selected as a separate example, never as a production mode
toggle. Verify real PostgreSQL races and an installed disposable host in both modes.

## Archive reconciliation

These requirements were synchronized into the current spec and subsequently
updated. Their obsolete `ADDED` operations are omitted from this archive delta;
the current requirements and all their scenarios remain authoritative:

- [Stay booking presentation](../../specs/reservations/spec.md#requirement-stay-booking-presentation)

The remaining delta blocks already match the current spec. Archiving this change
must leave the current spec unchanged. The implementation and verification notes
above describe the original delivery; later changes retain their own ownership.
