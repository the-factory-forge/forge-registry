# Mailing

Mailing is a stateless service plugin for transactional email. Read the
[integration guide](../../../../docs/mailing.md),
[Mailing requirements](../../../../openspec/specs/plugins/spec.md#requirement-mailing-service-plugin)
and [rendering/transport decision](../../../../concepts/adr/0012-mailing-rendering-and-transport.md).

## Logic and ownership

- `index.ts` exposes the content/brand contract and async `renderEmail`, returning
  HTML and matching plain text from the same host copy.
- `transactional-email.tsx` renders React Email components with inline, concrete
  theme values. Web CSS variables and the host's stylesheet cannot style inboxes.
  React escapes text; link/logo validation requires absolute HTTP(S) URLs without
  credentials before rendering can succeed.
- `resend.server.ts` is the separate server-only transport. It accepts host
  credentials, applies a request timeout, forwards the stable notification ID for
  idempotency and throws on delivery failure. Rendering never imports transport.

## Change boundaries

Keep recipients, translations, branding, authorization and retries with callers.
Mailing has no persistence, campaigns or queue. Reservations owns its notification
jobs and awaits default rendering or host formatters before sending; plain-text-only
formatters remain supported. Auth hosts own token and account-enumeration policy.
Inspect those callers when changing rendering or transport results.

## Checks

Use [mailing tests](../../../../tests/mailing.test.mjs) for escaping, URL rejection,
HTML/text parity and provider failure, plus
[showroom tests](../../../../tests/mailing-showroom.test.mjs) for preview changes.
Review `src/showroom/mailing-examples.ts`. Rendering tests do not establish delivery
or appearance in real inbox clients; those checks belong to host adoption.
