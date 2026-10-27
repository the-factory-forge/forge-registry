## ADDED Requirements

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
