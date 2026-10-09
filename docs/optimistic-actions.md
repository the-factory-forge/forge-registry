# Optimistic plugin actions

The seven data plugins install `@forge/optimistic-action`, which declares
`@tanstack/react-query`. It uses TanStack Query's
[UI-based optimistic mutation pattern](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates#via-the-ui).
A temporary transformation overlays the supplied data while a mutation runs.
Rejection removes the transformation, revealing the current host data. A failed
operation never restores an old whole-list snapshot over unrelated host updates.

| Plugin       | Optimistic changes                                                             |
| ------------ | ------------------------------------------------------------------------------ |
| Customers    | Verification, directory deletion and detail summary edits                      |
| Projects     | Directory deletion, detail name and status edits                               |
| Employees    | Directory creation, edits and deletion                                         |
| Blogs        | List deletion, draft/publication status, category creation, edits and deletion |
| Drive        | Folder creation, entry/space rename, trash, purge and restoration              |
| Menus        | Item order and deletion, category and label creation, edits and deletion       |
| Reservations | Approval, rejection, cancellation, rescheduling and service/resource archival  |

Mutation controls prevent duplicate submissions. Temporary records cannot be used
for follow-up mutations. Deletion hides the row but retains its confirmation
until the response, preserving errors and retry controls. Failed edits retain
entered form values. Success toasts and navigation requiring a saved record wait
for confirmation. Uploads, downloads, authentication, verification email, private
link revocation and booking receipts retain their server-confirmed behavior.
Editors already show their draft while saving; server-assigned IDs, versions,
resource allocation and permission changes are never treated as authoritative
until returned by the host.

## Host integration

Public plugin props and client signatures remain compatible. Callbacks must
reject on failure, including SDK results that encode errors as objects. Resolve
after updating the host's source data or await the affected query invalidation.
Keep successful mutation results if a later refetch fails; a read failure does
not mean the write was rejected. Hosts own cache keys, authorization, sorting,
filtering, route changes and private-cache cleanup after successful sign-out.

The utility uses an existing `QueryClientProvider` when present. Standalone
components create an instance-local client, with no process-global server cache
and no additional provider setup. Mutations do not retry automatically, queue
for reconnect, or persist to browser storage. Query mutation persistence must
exclude these UI mutations because their variables contain callbacks.

An accepted overlay lasts until the host supplies replacement data. Keep clients
stable, and remount pages when changing tenant, account or resource identity.
The utility's optional scope argument isolates pending results when a client,
resource or filtered page changes. It blocks overlapping writes within each view;
separate views retain independent mutation state. It never grants permissions or
changes the server's validation, version checks or idempotency contracts.

Rescheduling previews use the selected availability slot's start and end. The
server still checks capacity and returns the final resource, policy and version.
New bookings retain the confirmation flow because availability can change before
submission. Authentication, impersonation and email delivery cannot be inferred
from a local UI update.

## Verification

The existing plugin showroom routes demonstrate these changes. Their failure
controls reject mutations; Employees and Menus include a short request delay.
`tests/optimistic.browser.mjs` stretches the mock delay and asserts the immediate
state, failure rollback, retained drafts and retry behavior. The existing plugin
browser suites cover successful reconciliation, navigation and permissions.

Rebuild with `pnpm registry:sync` and install updated plugin items in each consumer.
Installing the helper alone does not update an already copied plugin. No storage
migration or server-companion change is required.
