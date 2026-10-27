# ADR-0012: Mailing rendering and transport

## Status

Accepted for local implementation on 2026-10-11. Registry implementation decisions
split from [shared ADR-0012](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0012-shared-transactional-mailing.md)
on 2026-10-26. Publication and consumer adoption remain separate.

## Context

Plugins need consistent transactional email without copying templates or owning
host credentials and copy. L'Aspic requested Up4it-like presentation and shared
registry ownership. Inbox clients cannot inherit application CSS.

## Decision

Mailing is a service plugin used by other features. Ship a reusable React Email
JSX template, an asynchronous HTML/plain-text renderer and a separate server
transport entrypoint. Render escaped content and reject unsafe URL schemes.
Keep browser-safe rendering separate from provider credentials and delivery.

Hosts await rendering before delivery. Reservations formatters accept synchronous
results or promises and preserve existing plain-text-only integrations. Formatting
or provider failures remain observable and retryable through the caller's existing
notification lifecycle; provider idempotency does not replace durable retry state.

Recipients, translations, authorization, delivery policy and branding remain
host-owned under the shared decision. Inline styles follow its concrete semantic
email values. Campaigns, shared queues and customer-specific workflows are outside
Mailing's scope. The linked showroom contract owns preview behavior.

## Alternatives and consequences

Copying one template per feature duplicates rendering and transport behavior.
React Email follows the requested Up4it authoring approach and supplies
email-compatible components. Async rendering requires callers to await the result.
Separate transport lets hosts retain attachments, reply-to and provider behavior.
Browser previews cannot certify every inbox's HTML support or forced colors;
actual host senders require separate integration and inbox evidence.

## Evidence and verification

See the [Mailing requirements](../../openspec/specs/plugins/spec.md#requirement-mailing-service-plugin),
[showroom contract](../../openspec/specs/registry-showroom/spec.md#requirement-barebones-mailing-examples)
and [integration guide](../../docs/mailing.md).
The [renderer](../../registry/components/plugins/mailing/index.ts),
[template](../../registry/components/plugins/mailing/transactional-email.tsx) and
[transport](../../registry/components/plugins/mailing/resend.server.ts) implement
these boundaries. This split was reviewed against Registry `9a36e9b`.

The original [change design](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/changes/archive/2026-10-23-add-shared-mailing/design.md)
retains historical validation, including provider failures and consumer installation.
Those records do not establish fresh runtime checks or current consumer deployment.
