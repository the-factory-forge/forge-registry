## Context

The showroom uses TanStack Start and Nitro with in-browser demo providers.
`forge-template` deploys through a Node 24 multi-stage image and Dokploy Compose.
Its auth, environment validation and migration entrypoint are unnecessary here.

## Goals and non-goals

Provide a self-contained image for customer browsing, including public registry
JSON. Preserve local demos and integration tests. Live authentication, database
provisioning, consumer updates and production deployment are outside this change.

## Decisions

Keep the registry's pinned pnpm version and explicitly select Nitro's
`node-server` preset. Generate endpoints during the image build. Copy only the
complete Nitro output to an unprivileged runtime. Exclude local secrets and
development output from the Docker context.

Let Dokploy assign container names and proxy the `app` service's internal port 3000. No host port, environment file, volume or database is required. Retain the
existing mock auth screens so customers can inspect their UI.

## Risks and verification

Nitro must include every required runtime dependency and public asset in its
output. Build and run the actual image without credentials, then exercise SSR,
assets, registry JSON and browser journeys. The public hostname remains a
deployment input. Local validation cannot establish production DNS or HTTPS.

## Rollout

Push the reviewed change, configure the confirmed hostname in Dokploy and deploy
the intended `main` commit. Roll back by redeploying the prior working image.
