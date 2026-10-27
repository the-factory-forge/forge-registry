## MODIFIED Requirements

### Requirement: Menus plugin

`@forge/menus` SHALL provide public menus and staff item/taxonomy editors. Items
SHALL contain one price in minor currency units, a category, translated name and
description, visibility, sold-out state, order, optional image and reusable
allergen/dietary labels. Missing requested translations SHALL use the base locale
for the whole entity. Public menus SHALL include only visible items; sold-out
items SHALL remain visible with a pending-colored status at the top right.

Public menus SHALL offer allergen exclusion and dietary filters based on the
labels present in their supplied items. A dish SHALL be excluded when it carries
any selected allergen and SHALL match every selected dietary label. Both groups
SHALL combine, matching dishes SHALL retain their ordering and sold-out status,
and categories without matching dishes SHALL be omitted. Choices SHALL remain
available after filtering. Controls SHALL support keyboard use, host-translated
labels and both themes; results SHALL be announced with a count or empty message.
Clearing filters SHALL restore all supplied dishes. New filter label overrides
SHALL be optional, and the unfiltered menu SHALL remain visible during SSR.

`@forge/menus-storage` SHALL provide `createMenusService`, Drizzle tables and the
`menusPlugin` Better Auth schema integration, using Drive storage for images.
The host SHALL configure sessions, currency, locales and image routes. Menus
SHALL NOT provide ordering, payment or checkout. Hidden/visible and unavailable/
available indicators SHALL use not-started/success and pending/success pairs.

#### Scenario: Publishing a menu item

- **WHEN** staff make a translated menu item visible
- **THEN** its public name, price, labels and configured image can be rendered
- **AND** marking it sold out keeps it listed with a visible availability status

#### Scenario: Combining allergen and dietary filters

- **WHEN** a guest selects multiple allergens and dietary labels
- **THEN** only dishes without any selected allergen and with every selected dietary label remain
- **AND** matching sold-out dishes retain their status, empty categories disappear, and filter choices remain available

#### Scenario: Empty results and reset

- **WHEN** no dish matches the selected filters
- **THEN** the public menu announces a translated empty result message
- **AND** the guest can clear filters to restore all supplied dishes

#### Scenario: Reusing translated filters

- **WHEN** a host supplies translated dish labels and optional filter UI labels
- **THEN** filter matching uses stable label IDs and the controls show the host labels
- **AND** keyboard interaction and narrow layouts remain usable in both themes
