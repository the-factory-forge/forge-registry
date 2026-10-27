# Restaurant menu printing

## Why

Restaurants already maintain dishes and visibility in Menus, but have no staff
workflow for producing a branded paper menu from those records.

## What changes

- Add an A4 portrait / A5 landscape preview with a session-only title and footer.
- Print every visible dish, its prices and labels through the browser dialog.
- Add optional staff navigation and a discoverable showroom example.

## Impact

- Owning change root: forge-registry. Affected capability: Plugins, Menus.
- forge-registry owns the portable component, labels, integration, guides,
  tests and generated distribution.
- Existing clients and storage remain unchanged. No new dependency, persistence
  or migration is required. Hosts opt in through their own authorized route.
- This extends Menus rather than introducing a separate plugin or TC listing.
