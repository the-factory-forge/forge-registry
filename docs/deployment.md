# VPS deployment

The public showroom uses the Node 24, multi-stage Docker and app-only Dokploy
deployment pattern from `forge-template`, reviewed at commit
`8db115f57c421684cd2c40fac924ef2da38a1d4f`.
The registry keeps its own Cove-based application and pinned pnpm version.

The image builds registry endpoints from the current source, then builds the
showroom with Nitro's `node-server` preset. Only `.output/` ships in the runtime
image, which runs as the unprivileged `node` user. The health check requests `/`.

No environment file, build arguments, database, authentication secrets, OAuth,
email or storage services are required. The image excludes local `.env*` files.
Auth screens remain interactive demonstrations with mock callbacks. They never
create real sessions, save credentials or send email. Other plugin examples use
demo data. Real auth and storage integration tests stay local and separate from
this deployment.

## Dokploy

1. Connect the `forge-registry` repository and select `main` after this change
   has been pushed. Verify the commit selected for deployment.
2. Use a Docker Compose deployment with `docker-compose.prod.yml` and the
   repository root as its build context. The service is named `app`.
3. In **Domains**, select `app`, enter the showroom's public hostname, use path
   `/` and container port `3000`, and enable HTTPS. Point the hostname's DNS to
   the VPS. Dokploy supplies proxy routing through its domain configuration.
4. Deploy. Leave build arguments, environment variables and start-command
   overrides empty. The image starts its own server on `0.0.0.0:3000`.
5. Check `/`, a demo such as `/en/projects`, and `/r/registry.json` on the
   resulting HTTPS URL. Run the smoke check below against that URL as well.

The Compose file publishes no host port, so it can run alongside other sites.
It does not fix a container name; Dokploy manages deployment names. A Dokploy
Application can also build the root `Dockerfile` directly, using container port
`3000` in its domain settings.

See Dokploy's [Compose domain configuration](https://docs.dokploy.com/docs/core/docker-compose/domains)
and [Compose naming guidance](https://docs.dokploy.com/docs/core/docker-compose/example).
Configure HTTPS and hostname redirects at the proxy. The showroom does not
require a build-time public origin. Choose the actual hostname in Dokploy; no
production hostname is assumed here.

## Local production check

Use port `3100` to leave the development server on port `3000` available:

```sh
docker compose -f docker-compose.prod.yml config --quiet
docker build -t forge-registry:local .
docker run --rm -d --name forge-registry-preview -p 127.0.0.1:3100:3000 forge-registry:local
TEST_BASE_URL=http://127.0.0.1:3100 pnpm test:deployment
TEST_BASE_URL=http://127.0.0.1:3100 pnpm test:browser
docker stop forge-registry-preview
```

Wait for the container to become healthy before running checks. The smoke check
verifies public SSR pages, client assets, every generated registry item, and the
absence of a live auth API. Browser checks require Playwright's Chromium.
For a deployed instance, set `TEST_BASE_URL` to its HTTPS origin instead.

The runtime needs neither a volume nor migration commands. Updating the
showroom means rebuilding and deploying the image from the intended commit.
Existing consuming websites still use the published GitHub `@forge` namespace;
hosting the showroom does not change their installed source or configuration.
