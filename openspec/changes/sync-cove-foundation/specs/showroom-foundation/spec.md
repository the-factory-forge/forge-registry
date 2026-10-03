## ADDED Requirements

### Requirement: Independent Cove foundation

The showroom SHALL adopt reviewed Cove foundation updates while preserving
registry distribution, public demos and standalone production startup.

#### Scenario: Synchronizing the foundation

- **WHEN** the approved upstream foundation is reconciled
- **THEN** framework and tooling dependencies use the reviewed exact versions
- **AND** existing showroom routes, themes, mocks, Portless and tests remain available
- **AND** production startup requires no authentication or database configuration

### Requirement: Complete source distribution

Explicit registry dependency pins SHALL match the versions validated for each
affected item, and generated endpoints SHALL come from the official builder.

#### Scenario: Installing reservations

- **WHEN** a clean consumer installs reservations from rebuilt endpoints
- **THEN** its dependencies resolve and the installed source compiles independently

### Requirement: Recorded upstream provenance

The repository SHALL record its reconciled Cove revision and document deliberate
exclusions without adding cross-repository build dependencies.

#### Scenario: Reviewing a later upstream change

- **WHEN** another sync starts
- **THEN** it compares Cove against the recorded revision and reviews exclusions
- **AND** it preserves local application behavior and uncommitted work
