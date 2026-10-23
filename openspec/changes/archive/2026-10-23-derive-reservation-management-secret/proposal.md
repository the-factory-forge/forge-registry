## Why

L'Aspic already derives its reservation signing key from its host secret. The shared guide still requires a separate reservation secret, forcing each host to duplicate the derivation or manage another credential.

## What changes

- Export `deriveManagementSecret` from the Reservations server companion and document the existing-host-secret setup.
- Keep the explicit `managementSecret` service option and provider-independent server boundary.
- Add deterministic key, invalid-input and private-link checks, regenerate distribution, and verify a clean shadcn installation.

## Capabilities

### Modified capabilities

- `reservations`: derive a stable, separate signing key from a host secret.
- `plugins`: document the server companion's new helper.

## Impact

Forge Registry owns this change root and its plugin contracts; Forge Spec retains the consumer record. Forge Registry owns the helper, server export, guide, tests and generated `reservations-storage` item. L'Aspic already implements the same derivation and needs no source refresh. Forge Template has no Reservations installation. Customer booking rules, routes, data and other registry differences are outside this change.
