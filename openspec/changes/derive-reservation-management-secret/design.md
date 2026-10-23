## Decision

Add the derivation to the existing server `links.ts` and re-export it through `server/index.ts`. Keep `managementSecret` explicit so the registry does not read host environment variables or depend on Better Auth. Validate the root's byte length before derivation. The fixed context and output match L'Aspic. No new dependency, SQL migration or old-key fallback is needed.

## Ownership and baseline

The registry worktree starts at `a070c8071586aa550fedeb16fad3dbd99d3a44c5` on the original `main` branch, which was clean. The Forge Spec worktree starts at `5e716a8a1a8c4a69d18dd0d8089170e9cd2fad2b` on `main`. Existing Forge Spec edits concern other work; no dirty baseline is copied or transferred.

The only item shipping `registry/components/plugins/reservations/server/links.ts` and `index.ts` is `reservations-storage`. Their targets are `@components/plugins/reservations/server/links.ts` and `index.ts`. No manifest item depends on `reservations-storage`; it depends on the browser `reservations` item. Existing declarations already ship both files.

L'Aspic relocates these files to `src/intranet/components/forge/plugins/reservations/server/` with `#/intranet/components/forge/plugins/` aliases and a `.ts` suffix in the links import. These two installed files match `3b8d28384b8dd60677baf33721efc71337915cca` after those transformations. That proves only these files' baseline. The installed service has customer adaptations, including fixed Chalet rules, so the whole plugin is not described as current.

## Consumers and migration

The inventory records only L'Aspic for Reservations. Its host `src/intranet/reservations/service.server.ts` already derives the identical key and uses it for the service and direct signing. Its authenticated functions and localized routes confirm active integration. Keep that implementation and all customer adaptations. Forge Template has no installed Reservations source or caller; its existing host guidance already documents this derivation. Unknown consumers remain uninspected.

Existing registry hosts may retain their explicit signing key. Adopting derivation changes the key and invalidates prior links. The plugin does not try a former key. Root-secret rotation also invalidates links. This work does not publish or deploy either source or consumer applications.

## Validation and transfer

Run registry formatting/lint fixes, unit tests, the local PostgreSQL reservation suite, distribution generation/checks, type checks and production build. Install `@forge/reservations-storage` into a disposable Vite consumer through a loopback namespace on port 3100, test the installed server export and restore the original namespace. Transfer only this task's diff back to the recorded original branches, verify it there, then remove both temporary worktrees and branches.
