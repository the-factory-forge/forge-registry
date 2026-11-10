# Supports

Supports is a staff-shared website maintenance queue. Read the
[integration guide](../../../../docs/supports.md) before changing authorization,
transport, uploads or cleanup, and the
[Supports requirements](../../../../openspec/specs/plugins/spec.md#requirement-supports-plugin)
before changing behavior.

## Flow and boundaries

- `index.tsx` composes the table, create dialog and discussion page. `composer.tsx`
  retains drafts and upload request IDs across retries. The host owns routing,
  query state and refresh; `types.ts` is the transport contract.
- `ui.tsx` renders Markdown without raw HTML or remote images. Attachment URLs
  are obtained through authorized reads; signed URLs never become saved content.
- `server/storage.server.ts` checks fresh staff membership before host permission
  callbacks. Customers share staff auth roles: never infer membership from role.
- Create/comment request fingerprints bind actor, operation and parsed input.
  Attachment claims and mutation receipts commit in the same transaction. Keep
  per-request locks, ticket row locks and attachment row locks in this order.
- Upload reservations commit before object writes. Unattached files belong only
  to their uploader; posting claims them for the staff-shared ticket. Cleanup
  locks and rechecks each record, retains failed work and reservation tombstones,
  and never removes committed attachments.

Keep author signatures after account deletion. Do not add edit/delete actions,
provider fields, delivery queues, notifications or connector dependencies here.
The guide records the separately planned connector behavior.

## Checks

Run `tests/supports.test.mjs`, `tests/supports.browser.mjs` and
`tests/supports-storage/storage.integration.mjs` for affected changes. Inspect
`src/showroom/supports-preview.tsx` and `supports-mock.ts` when client contracts
change. Storage fixtures own disposable databases and buckets; a working mock is
not evidence of persistence or authorization.
