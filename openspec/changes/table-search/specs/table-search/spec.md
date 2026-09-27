## ADDED Requirements

### Requirement: Portable expanding search

Forge SHALL distribute `table-search` with complete dependencies, exported props, overridable labels and a row-matching helper.

#### Scenario: Keyboard search

- **WHEN** the search icon receives focus or a click
- **THEN** the input expands and receives focus without overflowing sibling controls
- **AND** Clear or Escape resets the query while preserving focus
- **AND** an active query stays visible after blur and an empty query collapses unless `alwaysExpanded` is true

#### Scenario: Search visible by default

- **WHEN** a host sets the optional `alwaysExpanded` prop to true
- **THEN** the input is visible and keyboard reachable from the first render without autofocus
- **AND** clearing the query or moving focus outside the control leaves the input expanded
- **AND** omitting the prop preserves the existing compact behavior

#### Scenario: Searching the showroom homepage

- **WHEN** a visitor opens the showroom homepage
- **THEN** its search uses the shared TableSearch component with `alwaysExpanded`
- **AND** title and keyword filtering still combines with the selected category

### Requirement: Independent table queries

Each data table SHALL expose its own search button and retain independent query state or host callbacks.

#### Scenario: Multiple tables

- **WHEN** a query changes in one table
- **THEN** only that table's rows are filtered
- **AND** clearing the query restores those rows without changing another table's query

#### Scenario: Paginated data

- **WHEN** the host supplies paginated results and controlled search
- **THEN** the host filters the full collection before pagination
- **AND** changing search resets the relevant page or cursor through the existing callbacks

### Requirement: Reviewed consumer installation

The generated item SHALL be installable through shadcn and adopted by tc-website without cross-repository imports.

#### Scenario: Updating TC

- **WHEN** the generated local registry item is reinstalled
- **THEN** TC's existing table filters use that source and remain independent
- **AND** host adapters and the published namespace configuration are preserved
