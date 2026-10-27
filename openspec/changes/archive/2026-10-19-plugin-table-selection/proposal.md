# Plugin table selection

## Why

Agent keys support selecting multiple rows, but other deletable plugin tables
still require one confirmation per record. The same interaction should work
throughout the registry.

## What changes

Add reusable row selection, mixed select-all and confirmed bulk deletion to
Customers, Projects, Employees, Blogs, Menu items and Drive files/trash. Preserve
per-record permissions, deletion restrictions, preview tokens and partial retries.
Do not add a batch API or deletion to Drive spaces or calendar date grids.

## Impact

`forge-registry` owns implementation, parent showroom demos, tests and generated
items. `forge-spec` owns this change and the Plugins contract. Installed websites
need separate source adoption and translated labels; no consumer or deployment
change is authorized here.
