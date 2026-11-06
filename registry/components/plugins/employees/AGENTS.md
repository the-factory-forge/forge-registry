# Employees

Employees manages staff accounts through an admin-only directory. Read
[Employee UI](../../../../docs/intranet-auth.md#employee-ui),
[photos and retention](../../../../docs/employees.md) and the
[Employees requirements](../../../../openspec/specs/plugins/spec.md#requirement-employees-plugin)
for the affected flow.

## Logic and ownership

- `index.tsx` composes the paginated directory, invitation dialog and row actions.
  `schema.ts` shares validation, role checks and account types with the server.
- `server/employees.server.ts` creates a request-scoped `createEmployeeService`
  around the host's auth API and fresh actor. When Customers is installed, the
  host `directory` adapter excludes customer profiles before paging and mutations.
- Creation persists an account requiring password setup, then sends its invitation.
  Delivery failure returns the created account with `invitationSent: false` so an
  administrator can resend. Pending invitations take precedence over verification.
- `employee-delete-dialog.tsx` reviews host-supplied related-data groups. With a
  deletion adapter, single and bulk deletion use its preview/token/decision flow.
  The server's `removeEmployee` callback owns the complete atomic retention and
  account removal; it replaces provider deletion without a fallback after failure.
- `employee-photo-field.tsx` crops to WebP before the host upload callback.
  Photo writes are immediate and separate from saving account fields. Website
  visibility and public biography data remain host-supplied.

## Change boundaries

Employee pages require authenticated `currentUserRole` and render nothing for
non-admins. Hosts guard routes before loading data, hide employee navigation from
non-admins and keep reads/mutations behind fresh-session admin authorization.
UI checks never replace the service guard. Keep the list free of an enable/disable
access action, retain deletion confirmation and prevent self-deletion or loss of
the current administrator's role. Retention adapters must commit all selected
accounts together; their `Promise<void>` cannot represent partial success.

## Checks

Use [service tests](../../../../tests/employees.test.mjs),
[directory browser tests](../../../../tests/employees.browser.mjs) and
[collaboration browser tests](../../../../tests/employee-collaboration.browser.mjs).
For membership or transaction changes, also inspect
[customer/project persistence tests](../../../../tests/persistence/customers-projects.integration.mjs).
The showroom adapter is `src/showroom/employees-preview.tsx`.
