## Why

The showroom follows Cove at `b9f2b22`, but its framework and tooling versions
lag behind the reviewed upstream revision `ebd3e81`. The newer TanStack Start
release also fixes its server-function response vulnerability.

## What changes

- Reconcile the approved foundation dependencies with Cove, including Vite+ 1,
  pnpm 12, TypeScript 7 and React 19.3.
- Replace the Drive test's removed TypeScript compiler API with Node type stripping.
- Update the reservations item's explicit UI dependency pins and generated output.
- Record the upstream revision and intentional exclusions for future syncs.

## Capabilities

### New capabilities

- `showroom-foundation`: independently maintained Cove foundation and sync provenance.

### Modified capabilities

None.

## Impact

Only forge-registry changes. The showroom retains Portless, its existing routes,
theme, mocks, tests and production startup. Auth and storage companions retain
their existing Better Auth and Drizzle versions. No live authentication,
application database, deployment or consumer-site update is included.
