## MODIFIED Requirements

### Requirement: Projects plugin

`@forge/projects` SHALL provide `ProjectsPage`, embeddable `ProjectsList`, creation
and detail pages. A project SHALL belong to one customer and may have an assignee,
website URL, description and display image supplied by the host. Shared create
and edit forms SHALL expose only name, status and description and submit only
those fields. They SHALL NOT render Website URL, Owner or Assignee inputs or
require people directories to save. The host SHALL resolve and authorize the
customer relationship during creation and preserve existing metadata on update.
Site-specific editors SHALL remain in the host. Details/Drive sections SHALL accept
host destinations and supplied Drive content. Installing Projects SHALL include
Customers UI but SHALL NOT supply project persistence or an upload service.
Requested, prospect, under-construction and production statuses SHALL use
not-started, informational, pending and success color pairs respectively.

#### Scenario: Viewing projects for one customer

- **WHEN** a host provides a customer-scoped project list
- **THEN** the list includes only that customer's supplied projects and omits a redundant owner column
- **AND** its links preserve the host's customer and project context

#### Scenario: Editing a basic project

- **WHEN** a user opens either shared project form
- **THEN** the editable fields are name, status and description
- **AND** failed saves retain those values without requiring owner or assignee directories

#### Scenario: Saving without changing host metadata

- **WHEN** a host handles the three-field form payload
- **THEN** creation adds an authorized customer relationship from host context
- **AND** updates preserve existing ownership, website URL and assignment unless a separate authorized host action changes them
