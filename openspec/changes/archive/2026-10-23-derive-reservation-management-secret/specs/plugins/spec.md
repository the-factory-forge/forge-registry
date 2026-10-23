## MODIFIED Requirements

### Requirement: Reservations plugin

`@forge/reservations` SHALL provide public booking, private guest management,
staff year/month/week/day/agenda calendars and settings.

#### Scenario: Using the configured booking mode

- **WHEN** guests or staff use a Reservations installation
- **THEN** A host installation SHALL
  choose appointments or stays. Services define policies, resources supply capacity,
  and reservations occupy one resource for the full buffered interval. Stays SHALL
  use arrival/departure dates, allowed arrival times, configured checkout and local
  night counts. Selecting a date before arrival while editing departure SHALL switch
  to arrival selection and preserve departure. Appointments SHALL use fixed duration
  and working hours.
  Staff calendars SHALL support host-controlled resource, service and status filters.
  Agenda SHALL be the initial staff calendar view on desktop and mobile.
  The showroom SHALL persist non-default filters in the URL and remove defaults.

#### Scenario: Integrating reservation persistence

- **WHEN** a host installs the Reservations server companion
- **THEN** `@forge/reservations-storage` SHALL provide `createReservationsService` with
  PostgreSQL persistence, transactional conflict checks, idempotency, version checks,
  private management links and durable notification jobs. Its server exports SHALL include
  `deriveManagementSecret` for deriving a reservation key from an existing host secret
  without an additional environment variable. The host SHALL own email
  delivery, transport and staff authorization. The detailed
  [Reservations contract](../reservations/spec.md) SHALL remain authoritative for
  scheduling, policy snapshots, closures, cancellation, approval and mode compatibility.
  Payments, pricing, guest capacity, recurring bookings and clinical records are
  outside the plugin's current contract.

#### Scenario: Booking a stay

- **WHEN** a guest selects an arrival time and departure date in a stay installation
- **THEN** the server derives checkout and reserves one eligible resource for the entire buffered stay
- **AND** receipts, management and staff details show the same status and endpoints
