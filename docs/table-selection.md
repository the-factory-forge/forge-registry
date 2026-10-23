# Table selection

`@forge/table-selection` ships `useTableSelection`, `TableSelectionCheckbox` and
`TableBulkDelete`, with English defaults in `utils/table-selection-labels.ts`.
Examples are embedded in the Customers, Projects, Employees, Blogs, Menus and
Drive showroom tables. This helper has no standalone homepage card.

Pass only eligible visible rows to the hook, with a scope string identifying the
filter, page and resource. Selection is local UI state: scope changes clear it,
and removed rows are pruned. The native header checkbox exposes unchecked,
checked and mixed states to keyboard and assistive technology users.

The hook owns one deletion session: its target snapshot, preparation, pending
state, stable request IDs and failure-only retries. `TableBulkDelete` and Auth's
key dialog display that session and supply host callbacks. Auth keeps key rows
visible until the host refresh confirms their removal; ordinary tables keep
their existing optimistic row hiding.

`TableBulkDelete` keeps its tooltip-backed trash button visible in the header,
disabled with neutral pagination colors when nothing is selected. Selecting rows
enables the action, which confirms a snapshot of names. It awaits each
`onDelete(item, requestId)` in turn, hiding that row optimistically through the
existing mutation helper and restoring it on rejection. Keep the existing host authorization and
refresh logic in that callback; rejection means the item stays available for
retry. Request IDs remain stable when retrying within the same confirmation.
Successful rows are not resubmitted. A confirmed batch can finish across a host
refresh or automatic page reset; unmounting its control stops later calls.
A request already sent may still complete. Changing scope cancels an unconfirmed
session, including a pending preview; a late response cannot reopen it. If a
confirmed batch fails after a host page reset, its retry keeps the original
callback context instead of using the new view's resource.

Optional `prepare` fetches server-owned previews before confirmation. If it
fails, the dialog offers a preparation retry and blocks deletion. After partial
deletion, preparation runs again for failed rows so stale preview tokens are
never silently reused. Drive supplies its existing per-entry trash/permanent
delete callback and Undo notifications through this seam.

Keep selection and row mutations disabled while loading, on listing errors or
while a batch is pending. Hide the controls when deletion is unavailable and
exclude rows protected by the plugin. UI checks complement server permissions.
Supply translated `TableSelectionLabels` through the parent plugin labels; the
shared helper accepts partial overrides, as do its plugin integrations.

## Custom confirmation adapters and adoption

Custom dialogs use `selection.deletion.open(options, targets?)`, `confirm(options)`
and `close()`, and read `items`, `details`, `ready`, `failure` and `attempted`.
`TableDeletionOptions` supplies `onDelete`, optional `prepare` and `onComplete`.
Bind the stable `deletion.dispose` to the dialog control's unmount cleanup when
the selection hook lives in its parent. The hook also disposes on its own unmount.
Hosts still own authorization, persistence and refresh.

The former `setPending`, `delete` and `remove` hook methods are retired. Update
custom callers with the shared helper in one source adoption. Existing plugin
props and deletion callbacks are unchanged. Auth now declares `@forge/table-selection`
and receives `@tanstack/react-query` through `@forge/optimistic-action`; a Query
provider remains optional. See the [adoption handoff](./HANDOFF-bulk-deletion-session.md).
