# The Corner Support

One organization-owned GitHub App serves Forge Support repositories. Deploy
[`services/corner-support`](../services/corner-support/) once, separately from the
showroom and customer websites. It issues scoped tokens and forwards signed
webhooks; customer databases retain tickets, queues, mappings and receipts.
See [ADR-0019](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0019-shared-support-github-app.md).

## Register and deploy once

Register **The Corner Support** under
[`the-factory-forge`](https://github.com/organizations/the-factory-forge/settings/apps).
Use Issues read/write and Metadata read, with no other repository, account or
organization permissions. Disable user OAuth. Keep the App private while all
repositories belong to this organization. Install with **Only select repositories**;
another customer in this organization uses the same installation. Preserve other
selected customer repositories. Reserve this App for Support within each selected
repository: the connector recognizes its status echoes by bot identity.

The intended production origin is `https://support.the-corner.swiss`. Set the App
webhook to `/api/github/webhook`, subscribe to `issues` and `issue_comment`, and
keep SSL verification enabled. Activate after deployment and signed acceptance
testing. Registration, installation and a health response alone do not establish
working delivery. Existing customer Apps remain untouched.

Use the Dockerfile with build context `services/corner-support`, exposing port 8080
through the HTTPS reverse proxy. Mount the protected JSON configuration and RSA PEM
read-only, readable by the image's `node` user. Set `CORNER_SUPPORT_CONFIG` to the
JSON file's absolute path. Keep both files outside Git and the build context;
the Docker allowlist includes only runtime source and package manifests. The
service runs unprivileged. Monitor `/health` and failed-request status logs; health
checks process availability, not GitHub access or customer delivery.

[`config.example.json`](../services/corner-support/config.example.json) includes
the registered App ID `5774442` and bot ID `357095502`. Replace the sample site IDs
and credentials. Configuration is validated at
startup; malformed config, insecure URLs and duplicate mappings fail closed with
a sanitized error. Restart to apply changes. Start with one replica: caches and
in-flight requests are local. The service reuses Zod in a separately locked package.

Before adding an A/AAAA record for the service, check current DNS. Preserve MX,
SPF, DKIM, DMARC and mail-server addresses. An address such as
`support@the-corner.swiss` does not require the `support.the-corner.swiss` website
hostname. Use another hostname if that name already serves mail or another service.

## Add a customer

1. Verify private repository ID, exact owner/name, active Issues and the App
   installation. Add only that repository to the selected set, preserving existing
   selections. Verify numeric App and bot user IDs separately from the OAuth client ID.
2. Generate a unique 32-byte cryptographic credential encoded as base64url. Store
   only its SHA-256 hex digest as `credentialHash`; hand the original to this site's
   backend through protected storage. Generate a separate base64url webhook secret
   of at least 32 characters. App, site-webhook and maintenance secrets must differ.
3. Add its installation/repository IDs, exact owner/name, fixed HTTPS webhook URL
   and site webhook secret to the protected config. Restart the service. Forward
   destinations come only from this operator-owned config, never from caller input.
4. Configure the site's shared credential group using the
   [template guide](https://github.com/the-factory-forge/forge-template/blob/main/docs/supports.md).
   The token URL is `https://support.the-corner.swiss/api/token`. The customer never
   receives the App key or App-level webhook secret. Verify using the
   [setup skill](https://github.com/the-factory-forge/forge-skills/blob/main/skills/setup-github-access/SKILL.md).

Keep real credentials and customer mappings out of this library. Removing or
rotating a credential hash and restarting revokes further token issuance; existing
GitHub tokens remain usable until expiry unless separately revoked. Remove the
selected repository from the installation when offboarding requires immediate
GitHub access removal.

## HTTP contract and failures

- `POST /api/token`: bearer site credential, empty body, no query. Maps the credential
  to one repository, requests Issues write/Metadata read, verifies returned scope and
  private repository identity, then returns `token`, `expires_at`, `installation_id`,
  `repository_id`, `bot_user_id` with `Cache-Control: private, no-store`. Refreshes
  with less than one minute remaining; concurrent refreshes share one request.
  Callers cannot supply an installation, repository or permission override.
- `POST /api/github/webhook`: at most 1 MiB, raw HMAC-SHA256 validation before parsing,
  routing by installation **and** repository ID. Rejects unknown mappings and
  non-private repositories. Re-signs unchanged bytes with the site's secret,
  preserving event and delivery ID. Customer receipts own durable deduplication.
- `GET /health`: 204 when the configured process is running.

Network calls have deadlines and reject redirects. Authentication failures return
401, malformed input 400/413, rejected signatures or mappings 403, and upstream
failures 503 without upstream bodies or credentials. Service and proxy logs must
exclude headers, bodies, query strings and token responses. Apply normal proxy
request limits. Protect backups of the configuration and key as credentials.

Webhooks receive 204 after the customer endpoint succeeds. Unsupported signed
events, including ping, are acknowledged without forwarding. The relay stores no
bodies or retry queue. GitHub does not automatically retry failed deliveries:
keep the site's fifteen-minute reconciliation and minute worker schedules, monitor
failures and manually redeliver when needed. Backlog/pagination affect latency.
Outages delay GitHub delivery while local tickets and queued work remain available.

Issues write also permits modifying issues; it is not create-only. A compromised
customer credential is limited to its repository. A compromised service or App key
affects every connected repository. Installation rate limits are shared.

## Existing dedicated Apps

The template still accepts dedicated-App credentials. Migrate separately: freeze
local writes, drain/reconcile pending work and resolve uncertain jobs with the old
App. Pause workers and webhooks, preserve issue/message/receipt mappings and update
stored installation IDs through a reviewed host migration when needed. Reconcile
old bot-authored history before changing the bot ID so it cannot reappear as external
discussion. Verify existing bindings, old echoes and new issue/comment/status
delivery before resuming. Never re-export old tickets to fix identity mismatches.
Retire a dedicated App only after migration and an explicit removal decision.

## Verification

Run `node --test tests/corner-support.test.mjs` from the registry root. Tests use
generated keys and fake provider responses for token scope, customer isolation,
refresh, webhook routing/signatures, failure acknowledgement, body limits and
configuration validation. They never contact GitHub. Run the template's authentication
and Support composition tests too. Before production, exercise the container,
actual App permissions and an authorized staging repository end to end.
