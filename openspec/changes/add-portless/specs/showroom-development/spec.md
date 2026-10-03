## ADDED Requirements

### Requirement: Named development URLs

The showroom SHALL use a pinned Portless development dependency for `pnpm dev`.

#### Scenario: Starting the showroom

- **WHEN** a developer runs `pnpm dev` with the default proxy configured
- **THEN** the showroom is available at `https://forge-registry.localhost`
- **AND** Vite uses an automatically assigned port and hot reload works through the proxy

#### Scenario: Running a linked worktree

- **WHEN** a developer runs `pnpm dev` in a linked Git worktree
- **THEN** Portless prefixes the app hostname with the branch name

### Requirement: Direct development access

The showroom SHALL support bypassing Portless without editing project files.

#### Scenario: Installing registry items over local HTTP

- **WHEN** a developer runs `PORTLESS=0 pnpm dev`
- **THEN** Vite starts directly with its existing port configuration
- **AND** local consumers can use its `/r/{name}.json` endpoints
