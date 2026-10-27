## MODIFIED Requirements

### Requirement: Menus plugin

`@forge/menus` SHALL provide public menus and staff item/taxonomy editors. Items
SHALL contain a default price in minor currency units, optional size prices, a category, translated name and
description, visibility, sold-out state, order, optional image and reusable
allergen/dietary labels. Missing requested translations SHALL use the base locale
for the whole entity. Public menus SHALL include only visible items; sold-out
items SHALL remain visible with a pending-colored status at the top right.

Public menus SHALL offer allergen exclusion and dietary filters only for labels
assigned to at least one supplied visible item. The complete translated default
catalog SHALL remain available to staff in taxonomy and item editors. Labels used
only by hidden items or not assigned to an item SHALL NOT appear as public filter
choices. Supplied overrides SHALL NOT introduce unused public choices. A dish SHALL be excluded when it carries
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
and custom labels SHALL remain usable. Hosts SHALL be able to order assigned
filter choices through overrides, and the catalog SHALL NOT infer dish ingredients or dietary claims.
The default dietary catalog SHALL omit gluten-free, dairy-free, lactose-free,
egg-free, tree-nut-free, peanut-free, soy-free and sesame-free choices to avoid
repeating the allergen exclusion controls. Distinct dietary choices and supplied
custom labels SHALL remain available.
The default dietary catalog SHALL focus on common restaurant choices and omit
specialized nutrition labels such as Low carb, Keto and Sugar-free, as well as
Alcohol-free. Hosts SHALL retain the ability to supply those labels explicitly.
Spiciness SHALL be dish information, independent of dietary labels and filters.
Spicy SHALL NOT appear in the default dietary catalog. Hosts SHALL be able to
assign spice levels zero through three in the staff editor and clear a level.
Public dishes with levels one, two or three SHALL show that number of decorative
flame icons and visible translated heat text; zero SHALL show no heat badge.
The default UI text SHALL be English and hosts SHALL be able to override it.

The storage companion SHALL persist spice levels and return them with public
menus. Invalid levels SHALL be rejected by service validation and the database.
Existing dishes and new items without a supplied level SHALL default to zero.
Older clients omitting the field during edits SHALL preserve the saved level.
The storage upgrade SHALL use an incremental, idempotent migration that preserves
existing data. Installing source SHALL NOT apply migrations, infer heat from
legacy labels or rewrite host taxonomy.
Installing source SHALL NOT seed production data automatically.

Items SHALL support an optional ordered list of sizes, each with a stable ID,
translated name and its own minor-unit price. The first size SHALL be the default
selection and saved default item price. Empty or absent sizes SHALL retain the
single-price display. The staff editor SHALL support adding, translating, pricing
and removing sizes, require base-language names and retain drafts on save failure.
Public menus SHALL show every size and price, support keyboard selection, update
and announce the selected price, wrap on narrow screens and use host semantic
colors and translated UI labels. Missing size translations SHALL fall back
individually to the base locale. Size selection SHALL NOT create orders.

The storage companion SHALL persist sizes and return localized size prices in
public menus. Invalid prices, duplicate or empty size IDs, missing base names
and lists above 20 sizes SHALL be rejected. New items without sizes SHALL default
to an empty list. Older clients omitting sizes during an edit SHALL preserve the
saved sizes and their default price; explicit empty lists SHALL clear sizes.
A separate idempotent incremental migration SHALL add the sizes column without
losing existing data or resetting saved sizes. Source installation SHALL NOT
apply database migrations.

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

- **WHEN** a host renders a menu
- **THEN** only labels assigned to supplied visible items appear as public allergen and dietary choices
- **AND** choices stay available when guest filters hide dishes and unused overrides do not add public choices

#### Scenario: Keeping the staff catalog

- **WHEN** staff edit an item or its label taxonomy
- **THEN** the complete host catalog remains available, including labels unused by public dishes
- **AND** saving a label on a visible item makes its public filter available while removing its final visible assignment removes that choice

#### Scenario: Keeping existing host labels

- **WHEN** a supplied dish uses a custom ID for a recognized translated label
- **THEN** its filter uses the assigned host ID and replaces its matching default choice
- **AND** custom labels remain visible and no extra label is assigned to the dish

#### Scenario: Simplified default dietary choices

- **WHEN** a host uses the default catalog
- **THEN** the dietary choices omit the eight free-from variants already represented by allergen exclusion
- **AND** the allergen controls and distinct dietary options remain available

#### Scenario: Common restaurant filter defaults

- **WHEN** a host uses the default menu catalog
- **THEN** Low carb, Keto, Sugar-free and Alcohol-free do not appear as default choices
- **AND** common dietary choices, allergen exclusions and supplied custom labels remain available

#### Scenario: Saving dish heat independently

- **WHEN** staff select a dish's heat level and save it
- **THEN** the stored value survives navigation and database restart
- **AND** its public badge has one, two or three flames while dietary matching stays independent

#### Scenario: Clearing or omitting heat

- **WHEN** staff explicitly save zero
- **THEN** the public dish has no heat badge
- **AND** an older client omitting the field preserves the previous saved level

#### Scenario: Upgrading existing menus

- **WHEN** a host applies the incremental spice-level migration
- **THEN** existing dishes receive a zero default without losing data
- **AND** reapplying the migration retains saved heat values and invalid levels are rejected

#### Scenario: Selecting a pizza size

- **WHEN** a guest selects a supplied size such as 30 cm or 40 cm
- **THEN** the menu shows that size's price and announces the change
- **AND** all size prices remain visible and keyboard selection works on narrow screens in both themes

#### Scenario: Editing translated size prices

- **WHEN** staff save sizes with base-language names and individual prices
- **THEN** those sizes persist and appear with the requested names or per-size base-locale fallbacks
- **AND** the first size supplies the default item price, while save failures retain the draft

#### Scenario: Preserving or clearing sizes

- **WHEN** an older client omits sizes during an edit
- **THEN** the saved sizes and default price remain unchanged
- **AND** explicitly saving an empty list restores the single-price behavior

#### Scenario: Upgrading size storage

- **WHEN** a host applies the incremental sizes migration to an existing menu
- **THEN** existing items retain their single prices and receive empty size lists
- **AND** reapplying the migration preserves saved sizes and saved options survive database restart
