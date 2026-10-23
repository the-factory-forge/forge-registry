## Context

Blogs stores full object keys in its image ledger. Drive derives keys from UUIDs;
its rename and duplicate actions share immutable bytes. Recomputing keys from live
display names would break reads and cleanup. Menus reads images through Drive.

## Decisions

A small shared filename function ships with both companions. Keep UUID directories
and existing site/plugin and staging prefixes. Use `blog` or the Drive scope type
as the rebuilt type. Hyphens separate input fields; underscores join words within
a field. Keep the first asset-name field and existing modifier fields, replace
the input type, and omit missing or `original` modifiers. The user explicitly
chose rebuilding from context, including already structured filenames. Blogs uses
the validated format; Drive keeps its suffix or `.bin` when unknown. No content
conversion occurs. Existing stored names keep working, including the first
implementation's hyphen-only names.

Persist nullable `storage_name` on Drive entries and reservations. NULL selects
legacy paths; duplication copies storage identity, and all object operations use
that identity. Ship initial schema and an additive existing-host migration.

## Risks and rollout

Update all Drive writers and cleanup workers together after applying the migration.
Old workers cannot locate named objects. Existing keys are not renamed. Preserve
consumer host adapters and authorize adoption separately. l-aspic has an older
Blogs implementation; reconcile narrowly. Soleva's recorded paths are absent in
its current checkout, so its actual storage integration needs review.

## Validation

Exercise real uploads, finalization, downloads, rename/copy, trash, cleanup and
legacy pending objects against disposable PostgreSQL and MinIO. Verify safe names,
byte-derived image suffixes, generated distribution and a real consumer install.
