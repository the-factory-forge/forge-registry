## MODIFIED Requirements

### Requirement: Menus plugin

`@forge/menus` SHALL provide public menus and staff item/taxonomy editors. Items
SHALL contain one price in minor currency units, a category, translated name and
description, visibility, sold-out state, order, optional image and reusable
allergen/dietary labels. Missing requested translations SHALL use the base locale
for the whole entity. Public menus SHALL include only visible items; sold-out
items SHALL remain visible with a pending-colored status at the top right.

Public menus SHALL offer allergen exclusion and dietary filters with a default,
translated catalog and any labels supplied with their items. A dish SHALL be excluded when it carries
any selected allergen and SHALL match every selected dietary label. Both groups
SHALL combine, matching dishes SHALL retain their ordering and sold-out status,
and categories without matching dishes SHALL be omitted. Choices SHALL remain
available after filtering. Controls SHALL support keyboard use, host-translated
labels and both themes; results SHALL be announced with a count or empty message.
Clearing filters SHALL restore all supplied dishes. New filter label overrides
SHALL be optional, and the unfiltered menu SHALL remain visible during SSR.

Public menus SHALL provide sticky category navigation using the supplied category
names and order. Selecting a category SHALL scroll to its section without hiding
other matching sections. The current section SHALL be highlighted while scrolling.
The row SHALL scroll horizontally on narrow screens, support keyboard navigation,
use host semantic colors and omit categories without matching dishes. Hosts SHALL
be able to account for a fixed header without editing distributed source.

Public menus SHALL show ingredient/diet icons and semantic status badges on
assigned dish labels and filter choices. Vegetarian and Vegan SHALL use success
green, Gluten SHALL use pending orange, and Milk SHALL use informational blue.
Visible text SHALL remain and selected filters SHALL retain clear checkbox and
focus states. Colors SHALL identify labels rather than allergy reaction severity.
The default catalog SHALL cover the 14 standard allergen groups and common dietary
options with English, French, German and Italian names. Existing host label IDs
and custom labels SHALL remain usable. Hosts SHALL be able to replace unused
defaults, and the catalog SHALL NOT infer dish ingredients or dietary claims.
The default dietary catalog SHALL omit gluten-free, dairy-free, lactose-free,
egg-free, tree-nut-free, peanut-free, soy-free and sesame-free choices to avoid
repeating the allergen exclusion controls. Distinct dietary choices and supplied
custom labels SHALL remain available.
Installing source SHALL NOT seed production data automatically.

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

#### Scenario: Navigating a restaurant's categories

- **WHEN** a guest selects a supplied category such as Starters, Tapas or Vegetarian dishes
- **THEN** the page scrolls to its section and keeps the other matching sections rendered
- **AND** the navigation highlights the current section and stays usable on narrow screens in both themes

#### Scenario: Filtering navigation categories

- **WHEN** filters leave a category without matching dishes
- **THEN** its section and navigation link are omitted together
- **AND** clearing filters restores both in their original order

#### Scenario: Scanning menu labels

- **WHEN** a guest views Milk, Gluten or Vegetarian on a dish or in the filters
- **THEN** each label has a recognizable decorative icon and a readable blue, orange or green badge respectively
- **AND** checkbox selection remains distinguishable from the label color in both themes

#### Scenario: Using the default filter catalog

- **WHEN** a host renders a menu without overriding its default filter options
- **THEN** the standard allergen and dietary choices appear in the requested supported language
- **AND** an unused allergen changes no dishes while an unassigned dietary choice yields no matches

#### Scenario: Keeping existing host labels

- **WHEN** a supplied dish uses a custom ID for a recognized translated label
- **THEN** its filter uses the assigned host ID and replaces its matching default choice
- **AND** custom labels remain visible and no extra label is assigned to the dish

#### Scenario: Simplified default dietary choices

- **WHEN** a host uses the default catalog
- **THEN** the dietary choices omit the eight free-from variants already represented by allergen exclusion
- **AND** the allergen controls and distinct dietary options remain available
