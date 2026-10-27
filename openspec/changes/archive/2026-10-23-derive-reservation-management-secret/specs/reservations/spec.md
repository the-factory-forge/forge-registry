## ADDED Requirements

### Requirement: Host-derived management signing key

The server companion SHALL export `deriveManagementSecret` to derive a reservation-only signing key from an existing host secret without another environment variable. The helper SHALL reject roots shorter than 32 bytes, remain independent of environment variables and authentication providers, and derive stable keys. Hosts SHALL supply cryptographically random secrets. The explicit `managementSecret` service option SHALL remain supported.

#### Scenario: Reuse a stable host secret

- **WHEN** a host derives the management key from the same root after restarting
- **THEN** it uses HKDF-SHA256 with an empty salt, context `forge/reservations-management/v1`, and 32 output bytes encoded as base64url
- **AND** links remain verifiable using the same derived key in the service and direct signing
- **AND** verification using the raw root secret or a key derived from a different root fails

#### Scenario: Reject a short root secret

- **WHEN** a host supplies fewer than 32 bytes to the derivation helper
- **THEN** it fails with `INVALID` before deriving a signing key

#### Scenario: Change the signing key

- **WHEN** a host changes its root secret or replaces a separate signing key with a derived key
- **THEN** signatures made with the previous key are invalid
- **AND** verification does not fall back to a former key

#### Scenario: Keep an explicit signing key

- **WHEN** an existing host continues supplying the same `managementSecret` directly
- **THEN** its existing service and private-link behavior remain unchanged
