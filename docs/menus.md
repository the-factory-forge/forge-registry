# Menus

`@forge/menus` provides a public restaurant menu and staff pages for items,
categories, and reusable allergen and dietary labels. `@forge/menus-storage`
adds Better Auth schema registration, Drizzle tables, and server operations. It
also installs Drive storage for private image uploads. No restaurant routes,
sessions, database migration, or bucket configuration are installed automatically.

## Install and integrate

```sh
pnpm dlx shadcn@4.19.1 add @forge/menus-storage
```

Import `MenuPage`, `MenuItemsPage`, `MenuItemEditorPage`, `MenuTaxonomyPage`, and
their types from `@/components/plugins/menus`. Import `createMenusService`,
`menusPlugin`, the Drizzle tables, and `menuImageDeleteGuard` only from
`@/components/plugins/menus/server`. Register `menusPlugin()` in the host's
Better Auth configuration and include the exported Drizzle tables in its schema.
Review `server/migration.sql` and apply it through the host migration workflow.
The migration creates three menu tables; Drive storage has its own migration.
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

One `MenuItem` belongs to one category and has a single price stored in minor
currency units. The website supplies one ISO currency code to the UI. Each
item has translated name and description, display order, visibility, sold out
status, optional image, and label IDs. Categories and labels have translated
names. An empty or absent requested translation falls back to `baseLocale` for
that whole entity. The base language name is required. Menu data remains in the
restaurant's database; no menu copy or branding ships in the registry.

Call `service.publicMenu(locale)` in the public route's server loader and pass
the result to `MenuPage`. It includes only visible items, grouped in display
order. Sold out items stay on the menu with a label. Supply `locale`, `currency`,
and a stable `imageUrl(itemId)` from the host. Public menu components can render
on the server. There is no ordering or checkout flow.

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

## Showroom and checks

Preview `/en/menus`, `/fr/menus`, and `/en/admin/menus`. In-memory edits survive
client navigation and reset on reload. The staff preview includes a failure
toggle and Drive's upload flow. Run `pnpm test`, `pnpm typecheck`, `pnpm check`,
`pnpm build`, and browser tests, then verify a local shadcn consumer install
before publishing. Test the storage companion against disposable PostgreSQL and
S3 services; do not point it at a restaurant or TC database during development.
