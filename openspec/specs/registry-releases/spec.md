# Registry releases

## Purpose

Define registry-wide source releases with item-level impact and portability checks.

## Requirements

### Requirement: Registry release identity and compatibility

The registry SHALL use one repository-wide semantic version sequence under the
shared source-release policy. Compatibility SHALL cover item APIs, targets,
dependencies, styles and host/server setup. The highest affected contract impact
SHALL determine the bump; item-level adoption SHALL remain independent.

#### Scenario: One plugin breaks while another is unchanged

- **WHEN** a release removes a required Reservations prop but leaves Menus unchanged
- **THEN** it receives a major increment with the affected item and migration identified
- **AND** it does not claim that Menus or any customer has adopted a new version

### Requirement: Complete release impact

Registry notes SHALL identify changed, added and removed items, server companions,
shared-file owners and transitive dependents from both previous and incoming
manifests. They SHALL explain dependency/setup changes, migration needs and
customer checks. Unknown consumers SHALL remain explicit follow-ups.

#### Scenario: A shared helper changes

- **WHEN** several plugins depend on a changed helper
- **THEN** the release lists those affected paths through reverse dependencies
- **AND** matching consumer inventory entries are reviewed without authorizing their updates

### Requirement: Source distribution release gate

A registry source release SHALL contain final generated shadcn output from its
manifest and pass repository checks plus real disposable consumer installation
of affected items and dependencies. Checks SHALL verify target/import resolution,
required styles and affected behavior. JSON parsing and showroom preview alone
SHALL NOT establish portability. Server changes SHALL use disposable test data.

#### Scenario: Generated JSON parses but a dependency is missing

- **WHEN** a clean consumer cannot resolve an item's declared or imported dependency
- **THEN** the candidate fails release readiness until corrected and rechecked
- **AND** no published tag is moved to hide the correction
