## Context

`MenuItem`, `MenuItemInput` and `buildMenu` define the portable data flow. The item editor calls `MenusClient`; the server service validates input and reads/writes PostgreSQL rows. The catalog also seeds the showroom. UI and storage ship as separate registry items.

## Decision

Use an optional `spiceLevel` integer union from zero to three. Zero hides the indicator. The reusable badge renders the corresponding number of decorative flames and visible host-translated text. A native staff radio group supports keyboard selection and clear choice labels. Spicy is removed from default dietary choices rather than adding another taxonomy kind.

The service defaults new items to zero, rejects invalid input and preserves saved heat when an older client omits the field during an update. Public menu projection includes the value. The existing authorization and optimistic version guards remain in place.

## Persistence and consumer adoption

Add `spice_level` to Drizzle and Better Auth, with a zero default and PostgreSQL range constraint. Keep the initial migration unchanged and add `server/spice-level.sql` for fresh installs after the baseline or for existing installations. The idempotent upgrade preserves existing rows and saved values. Hosts review and apply it before running the updated storage source. No live migration runs in this task.

Existing Spicy labels remain host data. Hosts review dish levels and retire those labels through their own taxonomy workflow. The catalog does not infer heat or alter ingredient claims.

This follows ADR-0002's portable UI and host adapters, ADR-0005's server authority and ADR-0007's incremental migration and host-owned data rules. No new runtime dependencies or framework imports are needed.

## Verification

Check default and invalid levels, one/two/three flame rendering, translated and narrow layouts, editor save/clear, database upgrade and persistence including restart, old-client saves, full registry checks and a consumer install of UI and storage.
