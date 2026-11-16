# Customer Support GitHub access

Each Forge customer uses a dedicated GitHub App installed on exactly that
customer's private Support repository. The customer's existing API obtains
short-lived repository-scoped tokens and receives GitHub webhooks directly.
No additional server application, token service or central JSON mapping is required.
See [ADR-0020](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0020-dedicated-support-github-apps.md).

## Set up a customer

Use the [setup skill](https://github.com/the-factory-forge/forge-skills/blob/main/skills/setup-github-access/SKILL.md)
and the installed host's [Support guide](https://github.com/the-factory-forge/forge-template/blob/main/docs/supports.md).

1. Locate or create that customer's App under `the-factory-forge`. Give it only
   Issues read/write and Metadata read. Install it using **Only select repositories**,
   selecting exactly the customer's private repository. Preserve unrelated Apps.
2. Set its webhook to the customer's HTTPS origin plus
   `/api/supports/github-webhook`, with SSL verification enabled. Subscribe to
   `issues` and `issue_comment`. User OAuth is unnecessary.
3. Prepare the App's private RSA PEM, a unique webhook secret, and verified App,
   installation, repository and numeric bot IDs in protected storage. The webhook
   secret must match GitHub and the host. Never share a multi-customer App key.
4. Set `SUPPORT_GITHUB_APP_ID`, `SUPPORT_GITHUB_PRIVATE_KEY`,
   `SUPPORT_GITHUB_INSTALLATION_ID`, `SUPPORT_GITHUB_REPOSITORY_ID`,
   `SUPPORT_GITHUB_BOT_USER_ID` and `SUPPORT_GITHUB_WEBHOOK_SECRET` in that site's
   server runtime. Set `SUPPORT_GITHUB_REPOSITORY` only when its name differs from
   the stable `SITE_NAME`. Keep secrets outside Git and public build output.
5. Deploy/restart within the authorized scope. Verify restricted token issuance,
   direct signed webhook acceptance, internal maintenance and authorized staging
   delivery. Registration or a webhook ping alone does not prove issue linkage.

The host caches tokens in memory, refreshes before expiry and validates permissions,
repository scope and private identity. Local persistence, queues, replay protection,
authorization and internal maintenance remain owned by the customer application.

## Existing shared-service hosts

Adopt the direct App adapter before changing credentials. Remove
`SUPPORT_GITHUB_TOKEN_URL` and `SUPPORT_GITHUB_SERVICE_TOKEN`, replace inherited App,
installation and bot identifiers with customer-specific values, and use the direct
App webhook secret. `CORNER_SUPPORT_CONFIG` is not used by current hosts.

Existing bindings may pin the old installation and bot. A credential change does
not migrate them: preserve tickets, jobs, mappings and replay receipts and review
any migration separately. Local-only discussions still require explicit export.

The former `services/corner-support` implementation remains legacy source for
previous consumers; it is not part of current setup. Do not deploy it for a new
customer or disable an existing deployment until its remaining consumers are
verified and its retirement is authorized. Outstanding installation tokens remain
valid until expiry or separate revocation.
