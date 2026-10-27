## ADDED Requirements

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
