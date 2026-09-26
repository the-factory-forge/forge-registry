## ADDED Requirements

### Requirement: Public standalone showroom

The registry SHALL provide a Node 24 production image that serves its showroom
and generated registry endpoints without authentication or external services.

#### Scenario: Running without credentials

- **WHEN** the image starts without an environment file or service credentials
- **THEN** the homepage and demo deep links return server-rendered pages
- **AND** client assets and `/r/registry.json` and its items are available
- **AND** auth examples use mock callbacks without a live authentication API

### Requirement: Dokploy hosting

The registry SHALL provide an app-only production Compose configuration that
exposes container port 3000 without binding a host port or requiring a database.

#### Scenario: Publishing on the VPS

- **WHEN** Dokploy builds the registry and routes a hostname to the `app` service
- **THEN** the image starts its own Node server without a command override
- **AND** the runtime uses an unprivileged user and an HTTP health check
- **AND** local environment files are excluded from the image build context

### Requirement: Independent deployment

The image SHALL build from the registry checkout alone using its pinned package
manager, lockfile and official registry builder.

#### Scenario: Rebuilding the showroom

- **WHEN** the image is rebuilt from a registry commit
- **THEN** generated endpoints match that commit's registry source
- **AND** no template checkout, migration command or consumer update is required
