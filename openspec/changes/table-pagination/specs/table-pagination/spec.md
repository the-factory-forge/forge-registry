## ADDED Requirements

### Requirement: Shared plugin table pagination

Paginated plugin tables SHALL use a shared controlled footer with translated control names, consistent spacing, responsive hit areas and visible keyboard focus. Counts and page numbers SHALL appear only when supplied. Disabled controls SHALL remain visible and prevent activation.

#### Scenario: Numbered pages

- **WHEN** a user browses Blogs or Employees
- **THEN** the footer shows the supplied total and current page
- **AND** unavailable directions remain disabled

#### Scenario: Cursor navigation

- **WHEN** a user browses Drive, trash or restore destinations
- **THEN** the footer shows the current page and Previous returns to the preceding visited page
- **AND** search, sort and folder changes reset the page and cursor history
- **AND** request guards keep unavailable controls disabled
- **AND** it does not claim unknown totals

#### Scenario: Reuse in a host

- **WHEN** a host installs an affected plugin
- **THEN** its dependencies include the shared footer and required helpers
- **AND** existing plugin props and translated labels continue to work
