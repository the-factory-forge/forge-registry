# Design

## Data and compatibility

Add optional `MenuItem.sizes`, an ordered array of stable IDs, minor-unit prices
and translated names. The first size supplies the default price and selection.
Keep the required existing `priceMinor` field, normalizing it to the first size's
price when sizes are saved. Empty sizes retain single-price behavior. Validate
unique IDs, base-language names, prices and a maximum of 20 sizes. Requested
translations fall back separately for each size.

Store the array in a JSONB column defaulting to empty. Ship a separate idempotent
upgrade after the existing baseline and spice migration. Both Drizzle and Better
Auth describe the column. The server preserves sizes and their default price
when an older client omits the field; explicit empty arrays clear sizes. The
existing authorization, optimistic version check and transaction boundaries apply.

## UI

Use the existing dedicated item editor and language tabs. Staff add size rows,
translate labels, enter exact decimal prices and confirm row removals. Removing
all rows restores the existing single-price input. Retain drafts on failures.

The public page renders all option names and currency prices in native radio
chips that wrap on small screens. Select the first size during SSR, allow arrow
keys and announce price changes. Use host semantic tokens and translated labels.
Size selection has no ordering or payment effects. Keep sold-out status, spice
information and allergen/dietary filters independent.

## Verification

Cover normalization, malformed inputs, locale fallback and omitted fields in
unit/storage tests. Exercise staff creation, translation, failures, clearing and
public keyboard selection on mobile in both themes. Apply and reapply migrations
in disposable PostgreSQL, verify persistence after restart, regenerate registry
output and compile an official shadcn consumer installation. Do not migrate live hosts.
