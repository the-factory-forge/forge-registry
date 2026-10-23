## Why

Staff cannot see assigned categories in the blog table. Long text must fit
without obscuring row actions.

## What changes

- Show localized assigned category names in the administrative table.
- Truncate long titles and category lists while retaining full accessible text.
- Preserve existing adapters through an optional list-item field.

## Capabilities

### Modified capabilities

- `plugins`: blog administration displays categories and constrains long text.

## Impact

The owning change root is forge-spec. Implementation, tests, documentation and
generated `blogs`/`blogs-storage` items belong to forge-registry. Hosts refresh
installed source or supply category names in custom list adapters. No database
migration or authorization change is required.
