# Design

Employees provides the review dialog and `EmployeeDeletionAdapter`. The site
supplies each plugin's records, choices and eligible replacements, so Employees
has no fixed dependency on Blogs or another data plugin.

The site owns authorization, preview freshness and one transaction covering
related records and account removal. `createEmployeeService.removeEmployee`
delegates that transaction without a second provider deletion or fallback.

`EmployeePhotoField` prepares the crop, then calls the site's upload handler.
Storage, public profiles and image dimensions remain site-owned. Existing
callbacks remain supported; this documentation change needs no database migration.

See the [requirements](specs/plugins/spec.md) for failure and permission rules,
and [Registry PR #19](https://github.com/the-factory-forge/forge-registry/pull/19)
for implementation and integration details.
