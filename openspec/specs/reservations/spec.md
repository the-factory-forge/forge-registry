# Reservations specification

## Purpose

Define the portable appointment and stay booking contract, persistence, guest management and host integration boundaries.

## Requirements

### Requirement: Portable appointment plugin

The registry SHALL distribute separate reservations browser UI and server companion items. Hosts SHALL own routes, translations, authorization, email delivery, credentials and migration application.

#### Scenario: Installing appointments

- **WHEN** a consumer installs the plugin
- **THEN** every required file, style and dependency is available
- **AND** installation neither applies migrations nor adds framework imports to shared UI

### Requirement: Validated resource availability

Appointments SHALL reserve exactly one eligible resource using the service duration and buffers. Weekly hours and date overrides SHALL bound the entire occupied interval. Pending and confirmed bookings SHALL block overlaps.

#### Scenario: Cleanup time

- **WHEN** a 45-minute appointment starts at 09:00 and has 15 minutes of cleanup
- **THEN** another appointment with no preparation buffer may start at 10:00 but not 09:45

#### Scenario: Concurrent requests

- **WHEN** two requests attempt the same resource and interval
- **THEN** at most one succeeds
- **AND** a duplicate request ID with the same payload returns the same reservation without creating another reservation

#### Scenario: Daylight-saving changes

- **WHEN** a local clock skips or repeats times
- **THEN** nonexistent start times are omitted and repeated times remain distinct UTC instants

### Requirement: Optional appointment month availability

Guest and staff appointment creation SHALL support an optional month availability
operation while retaining the existing daily availability fallback. The operation
SHALL accept a service, optional resource and first local date of a month, and
return only availability booleans for the Monday-first 42-date grid. The companion
SHALL validate inputs before reading storage and reuse one configuration load,
one occupancy load and one captured time for each request.

#### Scenario: A host supports batching

- **WHEN** the appointment booking month, service or resource changes
- **THEN** the form requests one month overview using the corresponding public or staff rules
- **AND** staff overview reads require the existing read permission
- **AND** selected-day slots continue to load separately and final booking still validates capacity

#### Scenario: An existing host omits batching

- **WHEN** its client supplies only daily availability
- **THEN** guest and staff appointment creation retain the 42 daily grid reads without a host interface migration

#### Scenario: A month read fails or finishes late

- **WHEN** the current overview fails
- **THEN** dates remain disabled and the existing refresh action retries that overview
- **AND** it does not launch daily fallback reads after a batch failure
- **AND** results from a previous month, service or resource cannot replace the current overview

#### Scenario: A different reservation flow is used

- **WHEN** guests or staff select stays, reschedule a reservation or inspect the staff calendar
- **THEN** those flows retain their existing reads and saved-policy behavior
- **AND** the month availability operation rejects stay installations

### Requirement: Guest management and approval

Services SHALL configure automatic or manual approval and a cancellation cutoff. Pending requests SHALL retain capacity until reviewed or cancelled. Customers SHALL manage only their own reservation using a valid private link.

#### Scenario: Customer reschedules a manual booking

- **WHEN** a customer moves a booking before the cutoff
- **THEN** the new time becomes pending and the old time is released in the same transaction
- **AND** a failed move preserves the original booking

#### Scenario: Cancellation boundary

- **WHEN** the current time reaches the saved cancellation deadline
- **THEN** customer cancellation and rescheduling are rejected
- **AND** authorized staff may override the deadline without overriding overlap protection

#### Scenario: Link revoked or expired

- **WHEN** a private link is invalid, revoked or expired
- **THEN** it exposes no reservation data and authorizes no mutation

### Requirement: Host-derived management signing key

The server companion SHALL export `deriveManagementSecret` to derive a reservation-only signing key from an existing host secret without another environment variable. The helper SHALL reject roots shorter than 32 bytes, remain independent of environment variables and authentication providers, and derive stable keys. Hosts SHALL supply cryptographically random secrets. The explicit `managementSecret` service option SHALL remain supported.

#### Scenario: Reuse a stable host secret

- **WHEN** a host derives the management key from the same root after restarting
- **THEN** it uses HKDF-SHA256 with an empty salt, context `forge/reservations-management/v1`, and 32 output bytes encoded as base64url
- **AND** links remain verifiable using the same derived key in the service and direct signing
- **AND** verification using the raw root secret or a key derived from a different root fails

#### Scenario: Reject a short root secret

- **WHEN** a host supplies fewer than 32 bytes to the derivation helper
- **THEN** it fails with `INVALID` before deriving a signing key

#### Scenario: Change the signing key

- **WHEN** a host changes its root secret or replaces a separate signing key with a derived key
- **THEN** signatures made with the previous key are invalid
- **AND** verification does not fall back to a former key

#### Scenario: Keep an explicit signing key

- **WHEN** an existing host continues supplying the same `managementSecret` directly
- **THEN** its existing service and private-link behavior remain unchanged

### Requirement: Safe configuration changes

Reservations SHALL retain their saved policy through later service edits. Referenced services/resources SHALL be archived, not deleted. Schedule changes SHALL preserve reservations and expose out-of-hours warnings.

#### Scenario: Closing an occupied date

- **WHEN** a new date exception would exclude an active reservation
- **THEN** saving the exception fails until staff move or cancel that reservation

#### Scenario: Business time zone changes

- **WHEN** staff change the business time zone
- **THEN** existing appointment instants and their saved display zone remain unchanged
- **AND** availability, revised schedule checks and rescheduling use the current business zone

### Requirement: Durable email notifications

Booking changes SHALL persist their notification job atomically. Mail failures SHALL remain retryable and SHALL NOT undo the booking. Links SHALL be expiring, revocable and scoped to a reservation.

#### Scenario: Email provider fails

- **WHEN** a committed reservation cannot be emailed
- **THEN** staff see the failed delivery and can retry it using a stable notification ID

### Requirement: Accessible discoverable calendars

The plugin SHALL provide public booking, private guest management, staff year/month/week/day views and an all-date list and settings. The showroom SHALL link the working example from All and Plugin filters and demonstrate English/French, errors, empty/loading states, mobile layouts and both themes.

#### Scenario: Keyboard booking

- **WHEN** a customer uses only a keyboard
- **THEN** they can select a date and time, review policies and submit without a pointer gesture

#### Scenario: Browsing a year

- **WHEN** staff select Year from the calendar views
- **THEN** twelve months beginning with the current viewed month appear as rows with numbered day cells
- **AND** counts respect the resource, service and status filters in the business time zone
- **AND** selecting a date opens Day view, and year navigation, leap dates and keyboard movement remain available
- **AND** reads retain the bounded list contract, deduplicate boundary-spanning reservations and report failed loads without partial counts
- **AND** month labels remain visible while the date cells scroll horizontally on small screens

### Requirement: Default staff calendar view

The staff calendar SHALL open in List on desktop and mobile unless the host supplies a selected view.

#### Scenario: Opening the staff calendar

- **WHEN** staff open the reservation calendar without a host-selected view
- **THEN** List is selected on desktop and mobile
- **AND** Year, Month, Week and Day remain available from the toolbar

### Requirement: Paginated all-date staff list

List SHALL replace Agenda and show all reservations regardless of calendar date,
subject to the resource, service and status filters. It SHALL retain start/end
information and existing detail actions, ordered by start time then ID. The List
toolbar SHALL omit date navigation, Today and the period heading. Shared pagination
SHALL replace date navigation with 20 records per page.

#### Scenario: Browse all reservations

- **WHEN** staff select List
- **THEN** past and future reservations of all statuses are reachable through pagination
- **AND** filters are applied before pagination on the server
- **AND** Previous is disabled on page 1 and Next on the last page
- **AND** loading retains existing rows with their actions and pagination disabled

#### Scenario: Restore list state

- **WHEN** staff reload or traverse Back/Forward
- **THEN** the showroom restores the list view, filters and `reservationPage`
- **AND** missing or malformed pages default to 1
- **AND** changing filters resets to page 1 and removes its query parameter
- **AND** other query parameters and the fragment remain intact

#### Scenario: Authenticated bounded list reads

- **WHEN** a host calls `listPage` with a page and optional filters
- **THEN** the service validates the request, checks fresh read authorization and returns `{ items, hasMore }`
- **AND** the database applies filters, stable ordering, offset and a bounded limit
- **AND** invalid inputs fail with INVALID and unauthorized reads fail with FORBIDDEN
- **AND** existing date-bounded `list` reads retain their 43-day limit

### Requirement: URL-synchronized staff filters

The staff calendar SHALL accept optional host-controlled resource, service and
status filters and report changes through a callback. Omitted values SHALL mean
All. Existing hosts without controlled filters SHALL retain local filter state.
The showroom SHALL synchronize these filters with `resourceId`, `serviceId` and
`status` query parameters. Routing SHALL remain host-owned.

#### Scenario: Restore a filtered calendar

- **WHEN** staff open, reload or revisit a calendar URL through Back/Forward
- **THEN** the dropdowns and reservation results reflect its filter parameters
- **AND** malformed IDs or unsupported statuses fall back to All

#### Scenario: Return to default filters

- **WHEN** staff return a dropdown to All
- **THEN** its query parameter is removed
- **AND** other filters, unrelated query parameters and the fragment remain intact
- **AND** clearing all filters leaves no filter parameters or empty question mark

### Requirement: Host-selected installation mode

The host SHALL select `appointment` or `stay` when creating the server service.

#### Scenario: Configuring and discovering an installation mode

- **WHEN** the host creates or reconnects to a Reservations installation
- **THEN** Clients SHALL receive the configured mode and SHALL NOT select a different mode
  per service or per request. The first successful setup mutation SHALL record the
  mode under the scheduling lock. Existing settings or records without mode data
  SHALL be treated as appointment data. Incompatible host configuration SHALL fail
  with `MODE_MISMATCH`; changing an established installation requires a separate
  migration. Mode discovery on a new empty installation SHALL remain read-only.

#### Scenario: Conflicting host configuration

- **WHEN** a host configured for stays connects to existing appointment data
- **THEN** configuration and booking operations fail without converting or overwriting records
- **AND** staff cannot change the installation mode from the settings UI

### Requirement: Overnight stay availability

Stay guests SHALL select arrival and departure dates and an arrival time within
the offering's configured daily arrival window.

#### Scenario: Selecting arrival and checkout

- **WHEN** a guest chooses the dates and time for a stay
- **THEN** The departure date SHALL be later
  than arrival and satisfy the saved minimum and maximum nights. Night counts SHALL
  use local calendar dates, not elapsed 24-hour periods. The server SHALL derive the
  end from the departure date and saved checkout time in the business time zone.
  The arrival window start is inclusive and its end exclusive; selectable times
  SHALL follow the saved interval from the window start.

#### Scenario: Allocating a stay resource

- **WHEN** the server checks capacity for a stay
- **THEN** Active stay resources SHALL be available continuously except for active bookings
  and inclusive blocked date ranges. Weekly appointment hours SHALL NOT constrain
  stays. Exactly one eligible resource SHALL cover the complete buffered interval.
  Preparation precedes arrival; cleanup follows checkout. Adjacent occupied intervals
  may meet. Minimum notice, cancellation deadlines and booking horizons SHALL apply
  to arrival; departure may exceed the arrival horizon within the maximum nights.

#### Scenario: Applying stay defaults and clock transitions

- **WHEN** the host configures stay policy or availability crosses a clock transition
- **THEN** Defaults SHALL be 1–30 nights with limits editable within 1–365, a 15-minute arrival
  interval and the existing common policy defaults. Arrival window and checkout
  require explicit configuration. Nonexistent arrival times SHALL be omitted and
  repeated arrivals SHALL have distinct UTC offsets. A nonexistent checkout SHALL
  make that departure unavailable; repeated checkout SHALL use the later occurrence.

#### Scenario: Cleaning before the next arrival

- **WHEN** checkout is at 11:00 with two hours of cleanup and the next guest needs 30 minutes of preparation
- **THEN** the next arrival cannot precede 13:30, even if its arrival window begins earlier

#### Scenario: Closure during a stay

- **WHEN** a blocked date intersects any part of a stay's buffered interval
- **THEN** that resource is unavailable for the whole requested stay
- **AND** staff cannot save a new overlapping closure until affected active stays are moved or cancelled

#### Scenario: Whole-stay resource assignment

- **WHEN** separate resources each cover only part of the requested range
- **THEN** automatic assignment reports no availability instead of splitting the stay

#### Scenario: Overnight policy changes

- **WHEN** checkout time or stay limits change after a reservation is created
- **THEN** that reservation and its rescheduling retain the original policy
- **AND** failed moves preserve the original dates and new manual-policy dates return to pending atomically

### Requirement: Stay booking presentation

Public booking, private management and staff forms SHALL use the host's mode.

#### Scenario: Using stay forms and booking details

- **WHEN** a guest or staff member opens a stay booking form or its details
- **THEN** Stay forms SHALL provide labelled arrival/departure selectors, an accessible
  calendar range and arrival choices, with direct date entry and no drag requirement.
  When Departure date is active, selecting a calendar date before the current arrival
  SHALL set that arrival date, activate and focus Arrival date, and preserve departure.
  Other departure selections SHALL retain the minimum-night restriction.
  Review, details and emails SHALL show both endpoints, night count, time zone and
  applicable policies. Failed submissions SHALL preserve dates and customer fields.
  Stay settings SHALL expose stay policy and blocked-date editors, not weekly hours.

#### Scenario: Showing stays in calendars and examples

- **WHEN** a stay is shown in staff calendars or the showroom
- **THEN** Calendars SHALL show stays across their dates. Year counts SHALL include every
  local date intersecting the arrival-to-checkout interval, including checkout day
  when checkout occurs after midnight. Filters, bounded reads and deduplication
  SHALL apply. The showroom SHALL include isolated apartment, hairdresser and clinic
  examples with state shared between each example's pages.

#### Scenario: Guest books and changes a stay

- **WHEN** a guest books or reschedules through the public or private form
- **THEN** keyboard date entry and arrival selection lead to a review with both dates and night count
- **AND** failures retain the original booking and entered form values

#### Scenario: Selecting an earlier arrival from departure selection

- **WHEN** Departure date is active and the user clicks or keyboard-activates a date before arrival
- **THEN** that date becomes arrival, Arrival date becomes active and its input receives focus
- **AND** departure stays unchanged, including across a month boundary
- **AND** dates between arrival and departure still edit departure when permitted by the minimum nights

#### Scenario: Stay crosses a month boundary

- **WHEN** a stay crosses a month or year boundary
- **THEN** each calendar shows the portion within its visible range
- **AND** Year counts each intersected date once per reservation without counting cleanup as an additional stay

### Requirement: Management back navigation

The private management page SHALL accept an optional host-owned destination and
render a back link beside its heading when supplied. The link SHALL use the
translated Back label for its accessible name and tooltip and remain available
during loading and errors. Hosts SHALL retain routing and private-token ownership.

#### Scenario: Return from a private management link

- **WHEN** a guest activates Back by keyboard or pointer after opening a management URL directly
- **THEN** navigation goes to the host-supplied booking URL without its private token
- **AND** the same control is available when the reservation cannot be loaded

#### Scenario: Keep existing callers

- **WHEN** a host omits the destination
- **THEN** the page shows no back link and its existing management actions remain available

### Requirement: Shared reservation month calendar

Public booking and staff Month view SHALL reuse the same month picker and navigation.
Staff appointment and stay creation SHALL use the same date-selection controls as
public booking. Existing stay endpoint and availability rules SHALL remain intact.

#### Scenario: Inspect a date in staff Month view

- **WHEN** staff open Month and select a date
- **THEN** the shared Monday-first calendar shows filtered reservation counts
- **AND** matching reservations appear beside the grid, or below it on small screens
- **AND** selecting a reservation opens its existing details and authorized actions
- **AND** stays count each intersecting local date, including checkout after midnight
- **AND** failed loads do not display false zero counts or an empty result

#### Scenario: Restore calendar navigation

- **WHEN** a host supplies controlled calendar view and date state
- **THEN** changes are reported without embedding routing in shared UI
- **AND** the showroom restores its validated view/date query parameters on reload and Back/Forward
- **AND** invalid values fall back to List and the example date, and defaults are omitted on navigation
- **AND** filters, unrelated query parameters and the fragment are preserved

### Requirement: Dedicated staff reservation creation page

The calendar's New reservation action SHALL link to a host-owned creation page.
The exported `ReservationNewPage` SHALL reuse the booking form with the authorized
admin client, localized labels, availability, validation and save error handling.
Hosts SHALL supply the destination, back link, selected date and post-save navigation.

#### Scenario: Creating from the staff calendar

- **WHEN** staff activate New reservation
- **THEN** a dedicated `/admin/reservations/new` page opens rather than a dialog
- **AND** the selected date initializes the form and the calendar view, filters, list page and fragment survive navigation
- **AND** reload and Back/Forward resolve the creation page and calendar correctly
- **AND** Back and a successful save return to the calendar, while a failed save keeps the form and its inputs
- **AND** staff may book appointments or stays even when public booking is disabled
