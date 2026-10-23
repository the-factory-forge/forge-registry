## ADDED Requirements

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

The plugin SHALL provide public booking, private guest management, staff year/month/week/day/agenda views and settings. The showroom SHALL link the working example from All and Plugin filters and demonstrate English/French, errors, empty/loading states, mobile layouts and both themes.

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
