# Shared deletion-session adoption

The selection hook now owns confirmation targets, preview readiness, pending state,
stable request IDs and failure-only retries. Ordinary plugin tables and Auth keys
share it. Host deletion callbacks and plugin props remain compatible. Drive still
requires fresh server preview tokens; Employee retention deletion remains separate.

Source status: unpublished change based on registry
`8529a53fcbdf5cad6c9091f2e652f5f55cf912f6`. That commit does not contain this
refactor. Resolve the eventual publication to its verified full SHA before adopting
remotely. No customer source, data or deployment changed in this task.

## Coordinated source update

Follow [sync-from-forge-registry](../.agents/skills/sync-from-forge-registry/SKILL.md).
Install the affected plugin and dependency closure together. Auth now depends on
`@forge/table-selection`, which brings `@forge/optimistic-action` and
`@tanstack/react-query`. A host Query provider is optional. Keep Auth rows visible
until its existing awaited deletion/refresh callback supplies updated metadata.

Search custom consumers for `useTableSelection`: its former `setPending`, `delete`
and `remove` coordination methods are retired. Use the session operations documented
in [Table selection](./table-selection.md#custom-confirmation-adapters-and-adoption),
or use `TableBulkDelete` unchanged. Update custom dialogs in the same adoption;
installing only the new helper can break callers of its retired methods.

Changed source is shipped by `table-selection`, `auth` and `drive`. Reverse
dependencies also reach `customers`, `customers-storage`, `projects`,
`projects-storage`, `employees`, `employees-server`, `blogs`, `blogs-storage`,
`menus`, `menus-storage`, `drive-storage`, `intranet-sidebar` and `intranet-shell`.
This dependency closure is not permission to overwrite unrelated installed source.

## Consumer evidence and follow-up

The six accessible checkouts below were inspected on 2026-10-23. Each has active
`src/intranet/security/agent-keys.tsx` wiring that awaits `$deleteAgentKey` and then
query invalidation. None contains `table-selection.tsx`; earlier table/key selection
adoptions remain pending. Preserve their localized Auth metadata, host authorization,
routes and storage adapters. Source revisions below identify inspected checkouts,
not installed registry versions or deployed state.

| Consumer           | Inspected commit                           | Follow-up                                                                                                                                                                            |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forge template     | `3399f44e13109b07f08ae9c3f46ae21efc2ebe51` | Adopt Auth and ordinary Employees selection together; generated sites remain separate.                                                                                               |
| L’Aspic            | `ff31f79f3ec3219b7a557aba2fe1ba81d6641811` | Review Auth, Employees and Blogs; retain family access and adapted Blog persistence.                                                                                                 |
| Seebach            | `f1658fe6f55157733cef0171ac361cc5a4a37384` | Review Auth, Employees and Blogs on the current target host. Inventory records newer source unavailable in this checkout; preserve its retention transaction and clinic adaptations. |
| SiniGest           | `b89d77a6331d592243d881a83c6dd426e10dd152` | Review Auth, Customers, Employees and Drive; preserve admin-only deletion and customer scope.                                                                                        |
| Soleva             | `1c4732ce4ab14565b6c0bc3d4feb0baeb43d1ad1` | Review Auth and Employees after reconciling existing local changes.                                                                                                                  |
| Terminal60         | `487436539604f77f449cf9e2808d85e57b6a6605` | Review Auth, Employees, Menus and Drive after reconciling existing local changes; preserve linked-file restrictions.                                                                 |
| The Corner Factory | Checkout unavailable                       | Re-establish the recorded Auth subset and sidebar/shell dependencies before adoption.                                                                                                |

Projects has no recorded installed consumer. Generic helper users and sites outside
the inventory remain uninspected. The central [consumer inventory](https://github.com/the-factory-forge/forge-specs/blob/main/consumers/sites.yaml)
tracks these pending updates separately from deployment.

## Verify each adoption

Check translated labels, permissions, keyboard selection, both themes and narrow
layouts. Confirm that scope changes dismiss unconfirmed and loading previews,
confirmed batches survive host page resets, failed-only retries retain request IDs,
duplicate submission is blocked, and unmount stops later calls. Already sent
requests can complete. For Drive, verify refreshed tokens after partial failure
and out-of-order preview completion. For Auth, verify rows stay visible until host
confirmation and that creation, secret display and individual deletion still work.
Run the site's required checks and record source adoption without inferring deployment.
