# Employee photos and related data

The admin-only employee directory remains documented in [Employee UI](./intranet-auth.md#employee-ui).

## Optional employee images

`EmployeePhotoField` is an optional field with a compact photo preview and an
outlined Choose photo / Change photo button. Translate these actions through
`labels.choose` and `labels.change`; existing label overrides remain optional.
The deprecated `labels.hint` is accepted for compatibility but is no longer displayed.
It crops and exports WebP before invoking `onUpload(file)`; rejection keeps the
crop open for retry/cancel. Its square 512×512 default suits an account avatar.
Supply `dimensions`, `labels` and `cropLabels` for another use.

On `EmployeesPage` or `EmployeeActions`, supply `onUploadPhoto(id, file)` and
optional `photoOptions` to enable it in the edit dialog. The callback must validate
bytes and fresh authorization, persist the photo, and refresh `employee.image`.
Photo changes are immediate and separate from account form submission.

Hosts can compose the field in their Employee tab. Public bios, professional
registers, visibility workflow, storage routes and card/portrait sizes stay in
the site. Employees' basic schema does not require a photograph or install a
public team-profile database.

## Photo storage

The host stores uploaded photo bytes in private S3-compatible storage. PostgreSQL
keeps asset metadata and durable object references, not file bytes or signed URLs.
Use [site/module-scoped keys](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/site-template/spec.md#requirement-site-and-plugin-scoped-object-storage)
and authorize reads on the server before exposing a photo.

Missing or unavailable S3 must reject uploads with a translated error, preserve
the crop, previous photo and other edits, and allow retry or cancellation. Never
fall back to storing new bytes in PostgreSQL. Employee management stays usable
without photo uploads.

When transferring database photos, preserve IDs and URLs, verify destination bytes
before switching reads, and retain originals until recovery is verified. Replaced
or abandoned photos need reference-aware cleanup. Cleanup metadata must survive
account deletion so failed S3 removals can be retried.

## Deletion with several data sources

Pass `deletion: EmployeeDeletionAdapter` to the employee directory/actions.
It replaces both row deletion and bulk deletion, so the ordinary handler cannot
silently skip the review.

1. `preview(employeeIds)` returns an opaque `token` plus groups with unique IDs,
   translated labels, item titles/links/status text, available choices and optional
   eligible replacements. Scope group IDs by employee when reviewing several.
2. The dialog expands affected items and requires an explicit choice per group.
   A choice with `requiresReplacement` also requires a listed replacement.
3. `confirm(employeeIds, token, decisions)` validates and commits the whole action.
   Rejection keeps feedback visible; reloading gets a fresh preview and choices.

Each installed plugin's host adapter supplies its group. Blogs commonly offers
keep signature, reassign and delete; another plugin can supply different choices.
There is no runtime plugin discovery or fixed dependency on Blogs. The showroom
uses Blogs and illustrative Pages groups without claiming a shipped Pages plugin.

The host must recheck fresh admin authorization, prevent self-deletion, include
all affected records, reject stale fingerprints/versions and invalid or deleted
replacements, and atomically process decisions and account/session removal.
Keep articles merely edited by the departing employee separate from authored
articles. Retain public signatures when keeping articles; an explicit reassignment
may update affected publications as well as drafts. Use the existing storage
cleanup lifecycle when deleting articles.

`createEmployeeService({ removeEmployee })` delegates removal to the host's complete
transaction. `service.remove({ id }, decision)` forwards the opaque decision only
after its admin/self checks. Validate it inside the callback. The companion does
not call `api.removeUser` afterward or fall back after failure. Hosts with their
own transactional endpoint can use the UI adapter directly. Block the provider's
native deletion endpoint when it would bypass retention. This is an integration
requirement, not something portable UI can enforce.

Resolve confirmation only after persistence and cache refresh. For bulk deletion,
the supplied adapter must provide all-or-nothing semantics. Its Promise<void>
result cannot describe partial success; processing some accounts and then
rejecting is not supported by this dialog.

## Verification

`tests/employee-collaboration.browser.mjs` exercises linked groups, replacement
validation, failure/retry, bulk choices and invalid-image/crop/upload retry while
retaining the edit form. Server tests cover delegated removal and authorization.
The showroom simulates the host transaction and upload; verify those integrations
against the consumer's own database and object storage before deployment.
