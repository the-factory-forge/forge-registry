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

## Meaning of confirmation and completion

Use [domain terms](../GLOSSARY.md) for the user's workflow and keep request
progress separate from the record's status:

| Term                  | Meaning                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| Deletion confirmation | The user approves submitting the selected deletion.                                    |
| Write success         | The host reports that the requested change was saved.                                  |
| Accepted completion   | The submitting view is still current and may apply completion feedback or local state. |
| Reservation status    | The booking's approval or cancellation state, independent of request progress.         |

A confirmed deletion can still fail. When it does, the confirmation retains recovery
controls; bulk sessions retain only failed records. Confirmed Customers/Projects
deletion may finish after a view change, while unconfirmed selection is dismissed.

A rescheduling request can succeed with a Pending reservation because manual
approval is required again. Closing the rescheduling dialog or restarting its
view does not cancel the reservation; a late write may still succeed without
being accepted by that view.

A draft save does not publish the article. Unsaved blog changes, the saved draft
and the current publication remain distinct even when they contain identical text.
An optimistic Published badge is a preview until publication succeeds.

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

## Completion and draft ownership

`useOptimisticAction(value, scope).run(preview, write, accept)` applies its preview
through TanStack Query and calls `accept(saved)` only while the submitting owner
is current. Put canonical local state, dialog closing and completion feedback in
that callback. `useMutationAction(scope)` provides the same guarded completion
and pending/error state for commands without a separate data preview.

Replacement clients, resource changes and unmount retire ordinary completion.
The underlying server request can still finish; retiring the UI is not cancellation.
Host callbacks that navigate or notify internally must guard those effects in the
host too: the registry cannot undo effects performed inside an awaited callback.
Keep callback results separate from subsequent reads so a failed refresh does not
turn a confirmed write into a reported write failure.

Reservations use one staff mutation owner for previews, selection and completion.
Explicit Refresh restarts that owner and clears selection and rescheduling inputs;
client replacement does the same. An older read cannot overwrite an accepted write.
Rescheduling and settings inputs are disabled during submission so canonical
responses cannot replace edits made while saving. Rejected submissions retain inputs.

Drive listing refresh preserves pending changes and recovery. Confirmed deletion
keeps its existing lifetime rules, including the Customers/Projects rules below.
Blog history publication previews Published only when the confirmed plan starts
publishing; rejection removes that preview. No extra background queue or persistent
form recovery is introduced. Menus retain their existing guarded mutation lifecycle.

## Customers and Projects deletion

Customers and Projects install `@forge/record-deletion`. Their lists and forms
own one single-record confirmation outside the removable row or trigger. Bulk
deletion continues to use `@forge/table-selection`.

An open confirmation follows the current display name but retains the selected
ID. Before submission, removing the record or changing the search, customer
scope or form record closes it. Once submitted, the original callback and ID
finish even if host data or the view changes. Host updates can remove the row
before resolving the callback without losing the confirmation.

Failure removes only the temporary deletion and displays the current host data.
The confirmation retains its error; retry is available only while the original
record remains in the same view and deletion is enabled. Closing returns focus
to the original trigger when available, otherwise to the owning list or form.
Unmounted views do not receive completion feedback or focus.

To reuse the module, call `useRecordDeletion` with current `items`, `getName`,
`onDelete`, translated `label` and `labels`, and a `returnFocus` ref to a container
with `tabIndex={-1}`. Pass the view identity as `scope`. Render its `items` and
`dialog` from that stable owner; use `RecordDeleteButton` to call
`open(id, event.currentTarget)` and disable competing actions while `pending`.
The existing [Customers](./customers.md) and [Projects](./projects.md) showroom
examples demonstrate the module without a separate helper homepage card.

## Verification

The existing plugin showroom routes demonstrate these changes. Their failure
controls reject mutations; Employees and Menus include a short request delay.
`tests/optimistic.browser.mjs` stretches the mock delay and asserts the immediate
state, failure rollback, retained drafts and retry behavior. The existing plugin
browser suites cover successful reconciliation, navigation and permissions.
`tests/record-deletion.browser.mjs` exercises controlled host refreshes, renames,
view changes, rejection, retry and focus recovery for both lists and forms.

`tests/optimistic-completion.browser.mjs` holds requests to verify rollback,
replacement and unmount isolation, reservation restart, draft locking and stale reads.
Blog draft and Drive recovery suites also cover list publication and ordinary rename.

Rebuild with `pnpm registry:sync` and install updated plugin items in each consumer.
Installing the helper alone does not update an already copied plugin. No storage
migration or server-companion change is required.

Recorded consumer follow-ups are forge-template and Soleva (Employees), l-aspic
(Employees, Blogs, Reservations), osthoepathie-seebach (Employees, Blogs), Sinigest
(Employees, Drive, Customers), and Terminal60 (Employees, Menus, Drive). Verify
current adapters against the [consumer inventory](https://github.com/the-factory-forge/forge-specs/blob/main/consumers/sites.yaml)
before adoption; custom features and marketing listings do not establish installed
plugin usage. This source change does not update or deploy those websites.
