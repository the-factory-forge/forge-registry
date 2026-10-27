## ADDED Requirements

### Requirement: Optional source installation

Plugins SHALL install through their declared `@forge` items with complete files,
styles and dependencies. Browser exports SHALL remain framework-neutral and
SHALL NOT import server companions or secrets. Installation SHALL NOT register
host routes, grant access, apply database migrations or deploy a website.
Hosts SHALL enable the features they need and retain control of their adapters.

#### Scenario: Installing a plugin

- **WHEN** a host installs a plugin or its server companion
- **THEN** it receives editable source and explicit integration contracts
- **AND** host setup and reviewed migrations remain explicit actions
- **AND** unrelated features are not enabled automatically

### Requirement: Host-owned authorization and data

Hosts SHALL supply business data, branding, translations, route destinations and
fresh server authorization. UI capabilities and hidden controls SHALL NOT replace
server permission checks. Plugin clients SHALL report safe errors without
exposing credentials, database details or another user's private data.
Server operations SHALL validate inputs and documented concurrency rules.

#### Scenario: A hidden action is called directly

- **WHEN** an unauthorized user bypasses the UI and submits a protected operation
- **THEN** the host or server companion rejects it using fresh authorization
- **AND** no mutation is performed

### Requirement: Maintain plugin documentation

Adding or materially changing a plugin SHALL update this capability's definition
or module requirement, its registry integration guide, manifest and showroom as
applicable. Guides SHALL identify exports, dependencies, optional companions,
authorization, migrations, host responsibilities and exclusions. Exact file lists
and dependency versions SHALL remain owned by the registry manifest and package
files rather than copied into this spec.

#### Scenario: Adding a new plugin

- **WHEN** Forge introduces another optional application feature
- **THEN** this spec explains its purpose and observable capabilities
- **AND** readers can find its guide and showroom entry from the registry
