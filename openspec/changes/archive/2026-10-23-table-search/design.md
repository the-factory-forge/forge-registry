## Design

Extract TC's controlled component using Base UI, Lucide and semantic utilities, without TC primitives or application imports. Ship row matching in `components/utils/table-search.ts` and re-export it from the component to retain TC's imports. Export props and allow translated search, placeholder and clear labels.

Each table owns its query. Existing remote search callbacks remain responsible for complete-result filtering and pagination. Employees supports controlled search with offset reset; its backwards-compatible fallback filters supplied rows. Menus and pricing filter their loaded records. Customer/project table headers remain mounted while loading.

The optional `alwaysExpanded` prop defaults to false. When true, the input stays
visible from server rendering onward, including after clearing and blur, without
autofocus. The showroom homepage uses this option and retains its existing query
and category filtering. Existing table callers need no changes. This follow-up
verifies installation in a disposable consumer; it does not update live sites.

The container clips input padding throughout the width transition and owns the focus ring. A two-table showroom demonstrates independent queries. Rebuild with the official registry builder, install through a temporary local namespace, then restore TC's published namespace and review dependency overwrites.
