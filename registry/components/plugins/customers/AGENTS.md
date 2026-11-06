# Customers

Customers supplies a contact/company directory and account-backed persistence.
Read the [integration guide](../../../../docs/customers.md),
[Customers requirements](../../../../openspec/specs/plugins/spec.md#requirement-customers-plugin)
and, for server changes,
[identity transactions](../../../../openspec/specs/plugins/spec.md#requirement-customer-identity-and-profile-transactions).

## Logic and ownership

- `index.tsx` composes list, creation and detail pages; `customer-form.tsx` edits
  contact fields. Projects and Sync panels are supplied by the host. `utils.ts`
  gives company names precedence over contact names for display.
- `server/schema.ts` links one customer profile to an auth user. Membership in
  that profile table distinguishes customers from employees; auth roles alone do not.
- `server/service.server.ts` authorizes requests and writes identity/profile
  changes in one transaction. Every `authForTransaction(tx)` operation and auth
  database hook must use that transaction. Email uniqueness uses the shared lock.
- Creation commits before invitation delivery. Delivery failure leaves the account
  available for resend. Contact-only edits avoid identity hooks; changing email
  resets verification. Removal rolls back when references such as Projects prevent it.
- Directory reads return bounded, individually authorized rows. A page may be
  empty and still have `nextCursor`; hosts must not interpret that as exhaustion.

## Change boundaries

Creation requires a real unique email and submits no password. Preserve host
single-use invitations and explicit adoption decisions for legacy email-less contacts.
Verification badges mutate verification only, preserving unsaved contact fields.
Single deletion belongs to `record-deletion`; batch deletion belongs to
`table-selection`.

Projects imports customer UI helpers. The optional
[Customers–Bexio connector](../../../../docs/customers-bexio.md) owns external sync
and provisioning; keep its dependencies and policies out of the base plugin.

## Checks

Use [customer tests](../../../../tests/customers.test.mjs),
[browser tests](../../../../tests/customers.browser.mjs) and, for server changes,
[transaction tests](../../../../tests/persistence/customers-projects.integration.mjs).
Inspect `src/showroom/customers-preview.tsx` and Projects callers when changing
shared helpers or callback payloads.
