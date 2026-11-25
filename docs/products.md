# Products

Install `@forge/products` for a public catalog, product detail pages and a staff directory. The shared editor handles creation and edits. Only the name is required. Staff can add a plain-text description, ordered characteristic label–value pairs, and a price. A catalog thumbnail, detail-page banner and gallery of additional product photos are independently optional. Each characteristic needs both fields. Products start private. Staff can publish or unpublish with the status badge in the directory. Without publication permission, the badge displays the saved status. Saving changes to a published product updates its public details immediately. Staff with deletion permission can permanently remove private or published products after confirmation.

## Install and connect

Configure the [registry namespace](../README.md#installing-from-the-registry), then run:

```sh
pnpm dlx shadcn@4.22.1 add @forge/products
# Optional PostgreSQL implementation
pnpm dlx shadcn@4.22.1 add @forge/products-storage
```

- Render `ProductCatalog` with the current public page, `currency`, and `locale`. The host public loader must call `publicList` or an equivalent server query that selects published rows before pagination.
- Pass `getProductHref={(p) => publicRecordPath("/products", p)}` to link catalog cards. Import `publicRecordPath` from `@/components/utils/public-identifier`, installed with Products. Include the locale prefix when the host uses localized routes.
- For `/products/:identifier`, load `service.publicGet(identifier, locale)`. Return a 404 for `NOT_FOUND`. Use `publicRecordRedirect(productsPath, identifier, product)` from the same helper. When it returns a path, redirect there, preserving the query and fragment and replacing the entry during client navigation. Otherwise render `ProductDetail` with the returned `product`, `currency`, `locale` and a catalog `backHref`.
- Staff can set or clear one optional URL slug across all languages. Slugs are unique and use lowercase letters, digits and single hyphens. Product UUIDs are reserved. Omit `slug` on a service update to keep it, or pass `null` to clear it. After a slug change, the product ID still resolves to its current page.
- Render `ProductDirectory` with the authorized page, controlled `sort` and `onSortChange`. Supply `createHref`, `getEditHref`, `onSetPublished`, and `onDelete` for permitted actions. Pass `search` and `onSearchChange` for the compact name search. Bind search, sort and page to the URL. Reset the page on a new query and pass the search to `staff.list`, which filters before pagination. Supply the footer through `pagination`, including on a single page. The host owns loading and error recovery. Apply the requested sort across the matching set before taking a page.
- Resolve `onDelete(id, version)` after removing the record from host data or invalidating the staff and public lists. Reject failed deletions so the dialog can show the error and offer a retry.
- Render `ProductForm` with `client`, `currency`, and `backHref`. Omit `product` for creation, pass `null` during an edit load, then pass the record from the staff loader. The form retains its input on failure. Its optional `onSaved` callback receives the confirmed record. Use a stable client per session and store, and remount the form when switching accounts.
- Use one ISO currency for the website. Store amounts in that currency’s integer minor units. For CHF, `1250` represents CHF 12.50. Zero is a price, and `null` omits it. The host supplies interface labels and locale.
- Pass `locales={[{ code: "en", name: "English" }, { code: "fr", name: "Français" }]}` to the form to enable language tabs. Keep the first language stable across routes. Existing content belongs to that primary language. Supply `locale` for formatting and to select its tab on entry when available. Staff can switch tabs without losing edits and save all languages together. Secondary languages can be left blank. A nonempty translation needs a name and complete characteristic pairs. Price and publication status belong to the product.
- Pass the visitor's `locale` to `publicList({ locale, ...pagination })`. The service uses saved content for that locale and falls back to the primary content as a whole. Custom write adapters preserve `translations` when omitted and replace the map when supplied. A custom public loader can use `catalogProduct(record, locale)`.
- Pass translated `labels` to the screens, `sortLabels` to the directory, and `linkComponent` to integrate a host router. Load later pages through the `pagination` slot on both lists.

## Product images

The editor accepts a site-relative path (such as `/images/notebook.jpg`) or an HTTPS image URL and an optional image description. A product can have one thumbnail, one banner and up to 24 gallery photos. Gallery photos appear in their saved order. Visitors can swipe or use the previous and next buttons. One photo displays on its own. Images are shared across content languages.

For file selection, supply `uploadImage(file)` to `ProductForm`. The adapter returns a durable image path or HTTPS URL after the upload succeeds. The picker accepts JPEG, PNG and WebP up to 10 MiB per photo. If the host uses protected media, pass the same `imageUrl(src)` resolver to the form, catalog and detail components. Store stable references and resolve temporary delivery URLs at read time.

The host owns file storage, authorization and cleanup. Validate the file contents on the server, scope uploads to the site and Products, and authorize private previews and public image reads against current publication. Clean up abandoned or removed uploads once no saved product references them. The storage companion saves image references and descriptions in PostgreSQL. On update, omitting `media` preserves it; passing `media: {}` clears it.

## Optional storage

Compose the exported `products` table into the host’s existing Drizzle schema, generate and review a migration, and apply it through the host migration workflow. See the [persistence guide](./persistence.md). Installing either item copies source only.

```ts
// Host server module. db and requireProductPermission are host-owned.
import { createProductsService } from "@/components/plugins/products/server";

const service = createProductsService({ db, authorize: requireProductPermission });
const catalogPage = await service.publicList({ locale: "fr", pageSize: 24 });
const staff = service.client(sessionContext);
const product = await staff.create({ name: "Notebook" });
await staff.setPublished(product.id, product.version, true);
```

For an existing Products installation, generate an additive migration for the `translations` JSONB column on `forge_product`. Its default of `{}` preserves existing content as the primary language. Add the nullable, unique `slug` column. Existing products keep their UUID URLs. Add the non-null `media` JSONB column with default `{}` for products without images. Apply the migration before running the updated storage companion.

The staff service checks `read`, `create`, `edit`, `publish`, or `delete` against fresh host authorization on every operation. Staff reads include private records. The public query returns catalog fields only, in case-insensitive primary name order with ID as the tie-breaker. Both lists return `{ items, nextCursor }` and accept a decimal offset cursor. Pages default to 50 rows and allow at most 100.

Pass the saved version to `save`, `setPublished`, and `delete`. Competing writes return `CONFLICT`. Reload the latest record and review it before resubmitting. Ordinary saves preserve visibility. On successful writes, update or invalidate affected staff and public data, including cached catalog pages and detail URLs under the ID, previous slug and current slug. Keep private data out of public caches. Map transport failures to safe errors and preserve the conflict code for editor feedback.

The [showroom catalog](https://registry.the-corner.swiss/en/products) and staff preview share in-memory records during navigation.
