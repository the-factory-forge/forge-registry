# Menus

`@forge/menus` provides a public restaurant menu and staff pages for items,
categories, and reusable allergen and dietary labels. `@forge/menus-storage`
adds Better Auth schema registration, Drizzle tables, and server operations. It
also installs Drive storage for private image uploads. No restaurant routes,
sessions, database migration, or bucket configuration are installed automatically.

## Install and integrate

```sh
pnpm dlx shadcn@4.21.1 add @forge/menus-storage
```

Import `MenuPage`, `MenuItemsPage`, `MenuItemEditorPage`, `MenuTaxonomyPage`, and
their types from `@/components/plugins/menus`. Import `createMenusService`,
`menusPlugin`, the Drizzle tables, and `menuImageDeleteGuard` only from
`@/components/plugins/menus/server`. Register `menusPlugin()` in the host's
Better Auth configuration and include the exported Drizzle tables in its schema.
Review `server/migration.sql`, `server/spice-level.sql`, `server/sizes.sql` and
`server/label-icon.sql` and apply them in that order through the host migration
workflow. Existing
installations only need the upgrades they have not yet applied after updating
their source. The upgrades add a constrained spice level defaulting to zero and
a sizes array defaulting to empty, plus a nullable label icon, preserving existing
dishes and labels. Reapplying them retains saved heat, sizes and icons. The initial
migration creates three menu tables;
Drive storage has its own migration.
Do not run both a manual SQL migration and generated Drizzle migration for the
same tables.

The host configures `createDriveStorage` for a `menu-item` scope. Its
`resolveScope` callback must verify that the item exists and that the current
staff session may manage it. Pass `menuImageDeleteGuard` as `canDelete` so Drive
cannot remove a selected image. Then pass that Drive storage instance to
`createMenusService({ db, drive, baseLocale, authorize })`. The `authorize`
callback checks a fresh Better Auth session for every staff call. Wire the
service's `client(context)` methods through an authenticated host transport with
validated inputs and CSRF protection. Its `MenusClient` type describes the
browser contract. Do not expose the service's staff methods to anonymous users.

The server companion supplies no Better Auth endpoints. The host owns its
routes and maps only `MenuError.code` values (`INVALID`, `NOT_FOUND`, `FORBIDDEN`,
`CONFLICT`, `IN_USE`, `STORAGE`) to safe HTTP responses. It must not return raw
database or S3 errors.

## Menu data and pages

One `MenuItem` belongs to one category and has a default price stored in minor
currency units, with optional sizes that each have their own price. The website supplies one ISO currency code to the UI. Each
item has translated name and description, display order, visibility, sold out
status, optional image, spice level, and label IDs. Categories and labels have translated
names. An empty or absent requested translation falls back to `baseLocale` for
that whole entity. The base language name is required. Menu data remains in the
restaurant's database; no menu copy or branding ships in the registry.

Call `service.publicMenu(locale)` in the public route's server loader and pass
the result to `MenuPage`. It includes only visible items, grouped in display
order. Sold out items stay on the menu with a label. Supply `locale`, `currency`,
and a stable `imageUrl(itemId)` from the host. `MenuPage` server-renders the full
menu and provides browser filters only for labels assigned to its supplied
visible items. Unused labels remain available in the staff editor. Guests can exclude dishes carrying any selected allergen and require
every selected dietary label. Both groups combine, empty categories disappear,
and Clear filters restores the menu. Labels on dishes and filter controls use
the same ingredient/diet icons and semantic status badges. Vegetarian and vegan
use `status-success`, Gluten uses `status-pending` for orange warning styling,
and Milk uses `status-info` for blue styling. The catalog defines each label's
tone; a selected filter also has a checked checkbox and focus-colored ring.
These colors identify labels rather than the severity of an allergic reaction. Filter headings,
instructions, result counts and empty messages are overridable through `labels`.
There is no ordering or checkout flow.

## Default labels and badges

`menuLabelPresets` exports the standard catalog with stable IDs, translated names
in English, French, German and Italian, icons and semantic tones. Its allergens
cover the [14 groups listed by EFSA](https://www.efsa.europa.eu/en/safe2eat/food-allergens):
gluten-containing cereals, crustaceans, eggs, fish, peanuts, soy, milk, tree nuts,
celery, mustard, sesame, sulphites, lupin and molluscs. The dietary options include
vegetarian, vegan, pescatarian, halal and kosher. Specialized nutrition
labels such as low carb, keto and sugar-free, along with alcohol-free, are not
included by default. Hosts can still supply their own labels. The default catalog omits gluten-free, dairy-free,
lactose-free, egg-free, tree-nut-free, peanut-free, soy-free and sesame-free
choices to avoid duplicating the allergen exclusion controls.

`MenuPage` shows only choices assigned to at least one visible dish, including
supplied custom labels. Labels used only by hidden items do not appear publicly.
Available choices come from the full supplied menu and stay available when guest
filters hide matching dishes. Staff retain the complete catalog in the taxonomy
and item editors so they can assign labels before they appear publicly. The
catalog never assigns or infers labels for a dish. Hosts keep responsibility for their ingredient and dietary data.

Known labels use their preset ID or a recognized name in the supported languages
to choose their icon and badge color. Existing host-assigned IDs are preserved
for filtering and replace their matching default option to avoid duplicates.
Custom labels default to a generic allergen or diet icon. Staff can choose an icon
in the New/Edit label dialog, which previews the choice before saving. The taxonomy
list shows each icon before its name; the item editor, public dishes and filters
use the same saved choice. Choose Automatic to restore the preset or generic icon.

`MenuLabel.icon` and `MenuViewLabel.icon` accept a `MenuLabelIcon` value from
`menuLabelIcons`. An omitted icon on update preserves the saved choice; explicit
`null` clears it. The storage service validates and persists icons. Apply the
incremental `server/label-icon.sql` migration before using the updated storage
companion. Override `icon`, `automaticIcon` and `iconNames` through `labels` to
translate the selector. Partial `iconNames` overrides retain English fallbacks.

Icon changes keep the existing badge colors. Unknown allergens use blue
informational badges; unknown dietary labels use green badges. `MenuLabelBadge`,
`MenuLabelSymbol` and their props types are exported for host views. Public allergen
and dietary choices sort alphabetically by their displayed names in the current
locale. Comparison ignores case and accent differences, and custom labels follow
the same ordering. The optional localized `filterLabels` prop remains supported;
its supplied order does not override alphabetical ordering or introduce unused
choices. Assigned custom labels remain available.

The showroom seeds its staff taxonomy with the catalog. Production installation
does not insert database rows. To populate a new host's taxonomy, use the catalog's
`kind`, `position` and `translations` with the existing authorized `saveLabel`
operation, omitting `id` for creation. Keep the returned database IDs for items;
the badges recognize the translated names. Review existing labels before seeding
to avoid creating duplicates. Seeding labels does not alter the table structure.

## Sizes and prices

`MenuItem.sizes` is an optional ordered array of `MenuItemSize` values. Each size
has a stable `id`, an integer `priceMinor` and translated names in `translations`.
Use labels such as Small/Large, 30 cm/40 cm for pizzas, or 2 dl/5 dl/1.5 l for
drinks. The host supplies the currency; all size prices use its minor units.
For example:

```ts
sizes: [
  { id: "30-cm", priceMinor: 2200, translations: { en: "30 cm", fr: "30 cm" } },
  { id: "40-cm", priceMinor: 2800, translations: { en: "40 cm", fr: "40 cm" } },
];
```

The first size is the default selection. Saving sizes sets the item's existing
`priceMinor` to that first price so older views still have a usable default.
The public menu shows every size and price in wrapping chips. Guests select a
size with native radio controls or arrow keys; the header price updates and is
announced. This selection is display information and does not create an order.
An empty or absent sizes array keeps the single-price display.

Staff add sizes in the item editor, translate their names using the language
tabs, and edit each price. Every size needs a base-language name; missing names
in other languages fall back individually. Removing every size restores the
single-price input. Removal takes effect when the item is saved. Override
`sizes`, `addSize`, `sizeName`, `removeSize`, `sizeHelp` and `baseSizeNameRequired`
through `labels`. The showroom's House pasta demonstrates two portion sizes.

The service validates at most 20 sizes, unique nonempty IDs, translated names
and exact nonnegative prices up to one billion minor units. New items omitting
sizes default to an empty array. Older clients omitting sizes during an update
preserve the saved array and its first price; send `sizes: []` to clear it.
The storage companion persists sizes and includes their localized names and
prices in public menus. Installing source does not apply the size migration.

## Spice information

Spiciness is dish information, independent of dietary labels and filters.
`MenuItem.spiceLevel` accepts `0`, `1`, `2` or `3`. It is optional for existing
host adapters; new items default to zero and older clients that omit it during
an update preserve the saved level. Send zero explicitly to clear the indicator.
The service validates the range, stores it with the item and returns it in
`publicMenu`. The database constraint also rejects values outside the range.

The item editor offers Not spicy, Mildly spicy, Spicy and Extremely spicy choices.
Public dishes show an orange badge with one, two or three decorative flames and
visible translated text. Zero shows no badge. Override `spiceLevel`, `notSpicy`,
`mildSpice`, `mediumSpice` and `hotSpice` through `labels`. `MenuSpiceBadge` and
its props type are exported for other host views. The showroom demonstrates a
two-flame dish and French badge labels.

Spicy is no longer part of the default dietary catalog. If a host already uses
Spicy as a dietary label, review each dish's heat level and retire that legacy
label through its normal taxonomy workflow. Source installation does not alter
existing labels or infer a heat level from them.

## Category navigation

Category tabs at the top scroll to the matching section, keep the full menu on
the page, and highlight the current section while scrolling. Their names and
order come from the supplied categories, so each website can use Starters, Tapas,
Vegetarian dishes, or its own categories. The sticky row scrolls horizontally on
narrow screens and omits categories without matching dishes. Its accessible
name uses `labels.categories`. Hosts with a fixed header can set
`--menu-top-offset` on the page through `className`, for example
`className="[--menu-top-offset:4rem]"`, to keep tabs and section headings below it.

Use `MenuItemsPage` for the staff directory, `MenuItemEditorPage` on dedicated
`/menus/new` and `/menus/:id` routes, and `MenuTaxonomyPage` for short category
and label forms. Supply the host's `MenusClient`, language options, destinations,
and optional router Link adapter. English UI labels are overridable. Creating an
item saves it hidden and without an image. Navigate to its edit route in
`onSaved`; there the Drive browser can upload a photo in its private item space.
The editor accepts ready JPEG, PNG, or WebP files up to 10 MB as a selected photo.
The server validates the bytes again before saving. Unselect an image before
deleting its Drive file. Remove all Drive files before deleting an item.

The public image route calls `service.readPublicImage(itemId)` and returns its
`Response`. It checks that the item is currently visible and references a ready
image file in its own Drive space. The response has `Cache-Control: no-store`
and never exposes a signed Drive URL. Do not place a cache in front of this
route unless hiding an item also invalidates that cache. Existing in-flight
responses cannot be revoked.

## Reordering items

The item editor omits the display-order field. Staff reorder items with the grip
handles in `MenuItemsPage`, using mouse/touch dragging or the Up/Down arrow keys
on a focused handle. Search must be cleared before moving rows. Saving disables
further moves; a failed save keeps the previous order and reloads current data.
While dragging, a floating name/category preview follows the pointer and the
source row fades. A line above or below the hovered row marks the exact insertion
position. Escape, pointer cancellation, or dropping on the source or outside the
table clears the preview without saving a move.
The table uses saved item positions. Public menus keep their category order and
apply item ordering within each category; dragging never changes an item's category.

Wire the optional `MenusClient.reorder(order)` method through the host's staff
transport to enable handles. It receives the complete ordered list of item IDs
and versions and returns the saved items in that order. The storage companion
checks fresh edit authorization and saves positions in one transaction. Duplicate
IDs, stale versions, and missing or added items reject the entire change. Item
content stays unchanged, and changed positions increment versions so stale item
editors cannot overwrite the new order. No schema migration is needed. Existing
clients without this method still render the table without handles.

## Showroom and checks

Preview `/en/menus`, `/fr/menus`, and `/en/admin/menus`. In-memory edits survive
client navigation and reset on reload. The staff preview includes a failure
toggle and Drive's upload flow. Run `pnpm test`, `pnpm typecheck`, `pnpm check`,
`pnpm build`, and browser tests, then verify a local shadcn consumer install
before publishing. Test the storage companion against disposable PostgreSQL and
S3 services; do not point it at a restaurant or TC database during development.
