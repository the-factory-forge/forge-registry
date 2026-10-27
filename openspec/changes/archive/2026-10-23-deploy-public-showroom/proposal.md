## Why

Customers need to browse the registry showroom online. The registry already
serves public demos without authentication, but lacks the Docker and Dokploy
configuration used for the Forge VPS.

## What changes

- Add a production image and app-only Compose configuration.
- Build the showroom and generated registry endpoints together.
- Document deployment without auth, database or other service credentials.
- Verify public pages, bundled assets and registry endpoints against the image.

## Capabilities

### New capabilities

- `showroom-deployment`: standalone public showroom hosting on the VPS.

### Modified capabilities

None.

## Impact

Only `forge-registry` changes. Registry item names, props, dependencies and
consumer installation contracts remain unchanged. `forge-template` supplies
deployment conventions only. This change does not publish to the VPS.
