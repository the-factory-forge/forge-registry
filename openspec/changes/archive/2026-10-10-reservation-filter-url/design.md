## Context

`ReservationsCalendar` currently stores filters alongside the calendar range.
`src/showroom/reservations-preview.tsx` is its showroom caller. ADR-0002 keeps
routing in host adapters. The manifest distributes admin.tsx and types.ts through
reservations; reservations-storage depends on that item.

## Decisions

Add optional `filters` and `onFiltersChange` props with `ReservationFilters`.
Keep existing local behavior when uncontrolled. Validate showroom query values
using the existing range schema fields. Router navigation preserves other query
parameters, hash and scroll; history restores filters without remounting the
calendar. Calendar date and view persistence are outside this request.

## Compatibility and verification

Existing callers need no migration. l-aspic's inspected adapter still uses the
uncontrolled calendar and must explicitly adopt routing to get URL persistence.
Browser regressions cover filtering results, reloads, history, invalid values and
default omission. Rebuild registry output and run repository checks. No new files
or dependencies alter distribution, so a fresh consumer installation is not required.
