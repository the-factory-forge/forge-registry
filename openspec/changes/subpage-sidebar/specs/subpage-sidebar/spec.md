## ADDED Requirements

### Requirement: Reusable local navigation

The registry SHALL provide a subpage sidebar reusing the intranet navigation
renderer, with grouped/nested links, exact active states, translated labels,
host link adapters, and a local selection callback for in-place views.

#### Scenario: Nested page navigation

- **WHEN** a parent has a destination and child pages
- **THEN** its link navigates and its separate labeled control expands the children
- **AND** its active descendant remains discoverable without duplicating account controls

### Requirement: Mobile access

Below the shared sidebar breakpoint, local navigation SHALL use a modal drawer
with keyboard focus management, Escape dismissal and ordinary-navigation close.
It SHALL NOT add another global intranet keyboard handler.

#### Scenario: Selecting a mobile destination

- **WHEN** a user opens the drawer and selects a page
- **THEN** the destination opens, the drawer closes and keyboard focus remains usable

### Requirement: Drive folder navigation

Drive SHALL place All files, nested folders and available Trash navigation beside
the file content. Folder expansion SHALL use scoped, paginated Drive reads and
retain retryable errors. Hosts without trash methods SHALL omit Trash.

#### Scenario: Expanding a folder

- **WHEN** a user expands a folder
- **THEN** its children load through the authorized client
- **AND** loading, failures and remaining cursor pages have accessible controls
- **AND** selecting a child uses the host's existing folder link contract
