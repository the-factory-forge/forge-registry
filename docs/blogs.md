# Blogs

`@forge/blogs` provides administration, a Markdown editor with a live TanStack
Markdown preview, category management, and public listing/article components.
`@forge/blogs-storage` stores Markdown in PostgreSQL and uploaded images in private S3.
S3 configuration is optional for text editing and publishing. Neither item
depends on customers, projects, or Drive.

Table pagination uses [`@forge/table-pagination`](./table-pagination.md), included
as a dependency. Existing host labels and paging callbacks remain compatible.

The article action bar stays visible while editing. Publishing focuses missing
content or untranslated selected categories; saving incomplete drafts remains supported.

## Install and compose

Configure the `@forge` namespace as described in the repository README, then:

```sh
pnpm dlx shadcn@4.22.1 add @forge/blogs
# Optional persistence companion, including the UI item:
pnpm dlx shadcn@4.22.1 add @forge/blogs-storage
```

Files install at `@components/plugins/blogs`. Browser exports are `BlogsPage`,
`BlogNewPage`, `BlogEditPage`, `BlogCategoriesPage`, `BlogIndexPage`, `BlogPostPage`,
`BlogMarkdown`, their props, shared types, labels, and `BlogsError`. Import server
code only from `@/components/plugins/blogs/server`.

The host supplies theme tokens, Tailwind source scanning, Link/Image adapters,
locales, labels, route destinations, an `assetUrl` resolver, and an authenticated
`BlogsClient`. English labels accept partial overrides, including error messages.
Dates are ISO UTC; the default public formatter uses UTC for consistent SSR.
Public components receive prepared data and can render on the server.

Status badges use the shared `status-success`, `status-pending`, and
`status-not-started` background/foreground pairs for Published, Unpublished
changes, and Draft. Existing hosts must add the [status theme tokens](../CONTRIBUTING.md#design-tokens)
and their `@theme inline` mappings before updating the blog item. The showroom
stylesheet does not ship with the item; forge-template supplies the defaults.

```tsx
<BlogPostPage
  post={post}
  categories={categories}
  backHref={`/${post.locale}/blogs`}
  categoryHref={(id) => `/${post.locale}/blogs?category=${id}`}
  assetUrl={(id) => `/api/blog-images/${id}`}
/>
```

## Editing and publishing

The editor's status badge toggles publication for the selected language immediately.
Save unsaved edits first. Published and Unpublished changes both mean the language
is live; clicking either unpublishes it. The existing Publish action still publishes
a saved revision without first taking the live translation offline.

`BlogsPage` accepts an optional `onSetPublished(id, locale, published, requestId)`
callback. With this callback and `capabilities.publish`, the table's language pills
toggle that translation immediately. Wire it to `client.get(id)` followed by
`client[published ? "publish" : "unpublish"]({ id, version: article.version, locale, requestId })`,
then refresh the list query. Hosts retain authorization, validation and version checks.
Without the callback or permission, badges remain read-only. Toggles show the new
status while saving, prevent duplicate clicks, and roll back with an error if saving
fails. Successful saves show the existing publication toast.

The administrative table shows each post's assigned categories. `BlogListItem.categoryNames`
contains names in the requested locale, falling back to an existing category translation.
The storage client supplies these names; custom list adapters should supply them too,
or pass categories to `articleListItem(article, locale, categories)`. The field is optional
for existing integrations. Long titles and category lists truncate visually; their full
text remains available on hover and to assistive technology.

`BlogsPage` accepts an optional `onDelete(id, requestId)` callback. With this
callback and `capabilities.delete`, each row shows a trash icon beside Edit.
The confirmation names the post and warns that deletion removes all translations
and publications. The host performs the authorized, version-checked delete with
the supplied request ID, then refreshes the list and adjusts pagination. Rejected
callbacks keep the dialog open with an error and allow retry. Without the callback,
existing list integrations retain their edit action; deletion remains available
in the editor when permitted.

Wire the callback to `client.get(id)` and then
`client.delete({ id, version: article.version, requestId })`. Do not pass a locale:
the operation deletes the whole article. Refresh the active list query after
success even if the client only marks its caches stale to avoid refetching a
deleted editor. When deleting the last row on a later page, navigate to the last
remaining page with the current search preserved.

An article groups linked translations. Each has its own title, slug, summary,
Markdown, image alternative text, draft, and publication. Thumbnail, banner, and
category assignments are shared. Publishing one language captures the current
shared settings for that language only; other live translations remain unchanged.

Creation and editing use language tabs, matching the back-office menu editor.
Save drafts explicitly before switching language or publishing. Failed saves and
ordinary prop rerenders preserve local values. Switching articles resets the
form. The host owns navigation; add its router's unsaved-change guard if protection
against leaving the editor entirely is required.

Editor IDs/names come from authenticated server context and dates from the server.
Saving and publishing record the acting editor separately from `shared.author`.
Public credit comes from the publication's author, never its last editor or a
later unpublished draft. Legacy publications without an author retain their
recorded editor attribution until explicitly migrated. The original publication date stays
stable across updates; publishing after an unpublish starts a new publication date.

Slugs use lowercase ASCII words separated by hyphens and are unique per language.
Titles do not automatically change existing slugs. Explicit slug changes take
effect when published; the host owns redirects. Unpublished/missing translations
have no public language fallback.

Categories form one translated tree with at most two levels. The post editor
nests child checkboxes beneath their parent with indentation and a connecting guide.
Selecting a child also selects its parent; clearing a parent clears its children.
Parent filters count each article once. Category slugs
are unique per language. Publication requires names in that language for every
selected category. Existing labels cannot be removed. Categories in use cannot
be deleted or reparented; parents with children cannot be deleted. Reassign drafts
and republish affected translations before deleting a category.

## Persistence and migrations

The required prefix is `<SITE_NAME>/blogs/`, derived by the host with
`getS3StorageConfig("blogs")`. Missing, site-only and unscoped prefixes are rejected.
All object reads and cleanup remain within that prefix.

The companion exports `createBlogsStorage`, configuration/database types, and
`blogsArticles`, `blogsCategories`, `blogsObjects`, and `blogsMutations` Drizzle
tables. Review `server/migration.sql` and apply it through the host migration
workflow. Installation does not apply migrations.

For Infomaniak, use its built-in encryption for all images; see
[Storage encryption and access](./plugins.md#storage-encryption-and-access) for
private bucket requirements and the separate live configuration checks.

For image uploads, use a private, dedicated, **unversioned** S3-compatible bucket. Versioned/suspended
buckets are rejected because deleting current objects leaves previous versions.
Configure credentials on the server only:

```ts
import { createBlogsStorage } from "@/components/plugins/blogs/server";

const storage = createBlogsStorage<HostRequestContext>({
  db, // Drizzle PostgreSQL database
  s3, // AWS SDK v3 S3Client, or undefined when image storage is not configured
  bucket, // server configuration, or undefined; an empty value is also unconfigured
  locales: ["en", "fr"],
  keyPrefix: "my-website/blogs/", // derive from validated SITE_NAME
  authorize: async (context, permission, articleId) =>
    hostCanAccessBlog(context.session, permission, articleId),
  resolveEditor: async (context) => ({
    id: context.session.user.id,
    name: context.session.user.name,
  }),
});
```

Leave `s3` and `bucket` unset when developing with PostgreSQL only. Do not gate the
editor or call a host S3 configuration helper that throws before creating the
companion. Keep the explicit site/plugin prefix, which does not require a bucket.
Text creation, edits, categories and image-free publication remain available.
Keep authorized upload controls available: a missing S3 client or blank bucket
returns `STORAGE_NOT_CONFIGURED` before reserving an object. The existing action
toast shows the translated error and retains the editor draft. Transport adapters
must preserve this code; override its English label through `labels` as needed.
Configured provider failures still return `STORAGE`. Image reads/publication need
configured storage, and hosts should schedule maintenance only when it is configured.

The host must implement real authorization for `read`, `create`, `edit`,
`publish`, `delete`, `upload`, `changeAuthor`, and `manageCategories`. Grant `read` with write
permissions so mutation responses can return the refreshed article. Administrative
listing checks both list-level and per-article permissions. UI capabilities hide
controls but never authorize server operations.

PostgreSQL stores complete draft and publication snapshots, including Markdown, as
atomic JSONB documents. S3 stores uploaded images only. Saving or reading text
does not access S3; publishing checks the images referenced by that publication. Object reservations are committed before writes so a
failed database commit leaves cleanup metadata. Request IDs make retries safe;
article versions reject stale writes. Preserve the request ID on uncertain
transport retries and use a new one when changing input. Resolve version conflicts
explicitly without silently overwriting a local draft or advancing its version.

Writes, consistent reads, and maintenance use a shared PostgreSQL advisory lock.
Administrative permission filtering examines matching metadata before pagination;
public listing filters/paginates in SQL without fetching Markdown. These choices
fit small editorial sites. High-throughput hosts should move to per-article locks
and SQL-backed visibility rules. One configured database/schema represents one
website, not a multitenant authorization boundary.

## Object filenames

New images use `[asset_name]-blog-[modifier].[extension]` inside the existing
`<SITE_NAME>/blogs/<article-id>/<asset-id>/` directory, omitting absent modifiers.
Hyphens delimit fields; underscores separate words within a field. The uploaded
stem's first field supplies the asset name, `blog` replaces any existing type,
and remaining modifier fields are retained. Thus `the_corner-logo_mark-white.png`
becomes `the_corner-blog-white.png`, without stacking another type on the name.
Use underscores for words belonging to the same asset name.

Fields use lowercase letters, digits and underscores. Extensions follow validated
PNG, JPEG (`.jpg`) or WebP bytes: `Cover.JPG` with PNG bytes becomes `cover-blog.png`.
UUID directories keep same-name uploads distinct. The companion does not transform
bytes or invent modifiers; a supplied `original` modifier is removed. Existing
modifiers describe the uploaded variant, such as `thumbnail` or `white_bg`, rather
than where the image might later be displayed.

Existing object-ledger keys remain authoritative for reads, publication and
cleanup. No schema migration or existing-object rename is required. This source
update changes future uploads only; live consumer adoption remains separate.

## Updating consumers

Follow [HANDOFF: blog storage adoption](./HANDOFF-blogs-storage.md) when adopting
this revision. The owner confirmed no website used the former S3 Markdown flow,
so no legacy Markdown migration is provided. New installations use the companion
schema; existing custom database adapters preserve their article data and migrate
image bytes through the host's incremental migration workflow.

## Authenticated host transport

Keep adapters outside registry-managed paths. Resolve sessions for every request,
enforce HTTP body limits and CSRF/origin protections, and validate incoming DTO
shapes. Use an explicit action allowlist, never arbitrary method dispatch.

```ts
const context = await requireHostSession(request);
const input = parseBlogSaveInput(await request.json());
const article = await storage.client(context).save(input);
return Response.json(article, { headers: { "Cache-Control": "no-store" } });
```

Implement `BlogsClient` methods `list`, `get`, `categories`, `assets`, `create`,
`save`, `publish`, `unpublish`, `delete`, `upload`, `saveCategory`, and
`deleteCategory`. Serialize safe error codes (`INVALID`, `CONFLICT`, `FORBIDDEN`,
`NOT_FOUND`, `IN_USE`, `STORAGE`), not internal exception text. The host maps them
to HTTP responses and refreshes records after mutations.

Uploads go through an authenticated multipart route. Check size before buffering,
then pass bounded bytes to `storage.upload`:

```ts
const asset = await storage.upload(context, {
  id: articleId,
  requestId,
  name: file.name,
  contentType: file.type,
  bytes: new Uint8Array(await file.arrayBuffer()),
});
```

Every new image reserves a fresh UUID key under `<SITE_NAME>/blogs/<articleId>/`.
Uploads use ordinary PUT requests so providers such as Infomaniak do not need
conditional PUT support. Reusing a filename creates a separate image; thumbnail,
banner and Markdown references keep their stable asset IDs. Existing-key migration
scripts must still reject a destination whose bytes differ.

Defaults are 10 MiB per image and 1 MiB per Markdown document. The companion checks
these limits again on the server. When overriding `maxImageBytes` or
`maxMarkdownBytes`, pass matching values to the editor/public components and
override the image-limit hint label. The companion checks
byte length, MIME type, and JPEG/PNG/WebP signatures. SVG and other formats are
rejected. Signatures are not a full image decoder; optional transcoding/scanning
belongs in the host pipeline. Browser-to-bucket CORS and presigned uploads are
unnecessary because transfers use the host endpoint.

## Crop new thumbnail and banner uploads

`BlogEditPage` crops thumbnail and banner images by default at 1200×900 and
1600×900 respectively. Override `imageDimensions`, for example
`{ thumbnail: { width: 1200, height: 675 } }`, to crop only those configured fields,
or pass `false` to retain original uploads. Selecting a configured image opens
[`ImageCropDialog`](./image-crop.md). Nothing reaches `client.upload` until
the editor confirms; it receives a `.webp` File at the requested dimensions.
Cancel preserves the current image. Upload failures retain the crop for retry.
Use `imageCropLabels` for translated dialog labels.

Unconfigured fields, inline Markdown uploads and existing asset selection retain
their behavior. Both source and output must fit `maxImageBytes`; server validation
and authorization remain required. The showroom enables cropping for both fields
at 1200 × 675 by default. Disable **Crop new blog images (1200 × 675)** in its
settings to preview uploads without known dimensions.

## Public pages and images

Each public article card is one link covering its image, text and padding, with
the article title as its accessible name and a visible keyboard focus outline.
The Read more arrow moves up and right on card hover or keyboard focus, and stays
still when reduced motion is requested.

Article language switching belongs in the host navbar. `BlogPostPage` does not
render language links or accept a `translations` prop; remove that prop when
updating existing integrations and keep published locale URLs in the host navigation.

Public search uses the shared 44px field height, rounded corners and focus treatment.
It submits automatically 300 ms after typing stops, including when the field is
cleared, without a Search button. Enter still submits immediately. The native GET
form preserves the current category and resets pagination; hosts can intercept
its submit event for client-side navigation.

The public listing places categories above the posts on narrow screens, in a
compact disclosure that starts closed and supports keyboard toggling. At the
desktop breakpoint, categories remain expanded in the right sidebar.
Main categories use stronger text; child categories are indented with a vertical
guide. The current category uses the primary color at either level.

Call `storage.listPublished({ locale, search, categoryId, page, pageSize })` and
`storage.getPublished(locale, slug)` in server loaders. `publicCategories()`
provides taxonomy labels; show only categories with published counts. Return a
404 when `getPublished` returns `null`. The host sets canonical/alternate URLs,
Open Graph metadata, and indexing rules. Authenticated preview/admin routes need
`noindex` and private/no-store responses.

Inline Markdown uses `![alternative text](./assets/<assetId>)`, resolved through
`assetUrl`. Only uploaded images belonging to that article are accepted; arbitrary
remote images are not supported. Never store signed URLs in Markdown. Raw HTML/MDX
execution is disabled; ordinary safe links remain available. Enter meaningful
alternative text after inserting an inline image.

Stable image routes call `storage.readImage(assetId, optionalAuthenticatedContext)`.
Anonymous access requires a current publication referencing the image in at least
one language. Otherwise, article read permission is required:

```ts
const image = await storage.readImage(assetId, optionalSessionContext);
return new Response(new Uint8Array(image.bytes), {
  headers: {
    "Content-Type": image.contentType,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": image.cacheControl, // no-store
  },
});
```

Do not put unconditional CDN caching/image optimization in front of this route:
it bypasses authorization after unpublishing. Host caching must invalidate affected
posts/images on publish, unpublish, and deletion. Downloaded copies cannot be revoked.

## Maintenance and validation

Run `await storage.maintenance(100)` hourly from a trusted host scheduler. Log its
`examined`, `removed`, and `failed` results and retry failures on the next run.
Do not expose maintenance as a public HTTP action. Each bounded run rotates
through candidates so referenced old objects cannot starve later cleanup.

Unreferenced image objects, including those of deleted articles, have a 24-hour grace
period to outlive interrupted transfers; attach uploads to saved
drafts within that period. All current draft/publication references protect objects.
Article deletion immediately removes public visibility and leaves the image
ledger for retryable byte deletion. Never configure an S3 expiry rule over the
final object prefix. No external automation is created by installation. Mutation
records remain for retry safety; there is no user-facing revision/restore history.

Showroom routes are `/en/blogs`, `/en/admin/blogs`, and `/fr/blogs`. A dedicated
provider shares in-memory state across navigation; full reloads reset it. Controls
demonstrate different editors, permission differences, failures, and both themes.

The integration harness uses dedicated Docker volumes and fixed test-only
credentials on localhost ports 55440/19040. It never reads host credentials:

```sh
docker compose -f tests/blogs-storage/compose.yaml up -d --wait
pnpm test:blogs-storage
docker compose -f tests/blogs-storage/compose.yaml restart
docker compose -f tests/blogs-storage/compose.yaml up -d --wait
BLOGS_TEST_PHASE=restart pnpm test:blogs-storage
# Remove disposable integration data when finished:
docker compose -f tests/blogs-storage/compose.yaml down --volumes
```

Run `pnpm test`, the browser suite with `TEST_BASE_URL` set to the showroom URL,
and repository lint/type/build checks. Generate endpoints with `pnpm registry:sync`
and test independent UI/server installation in temporary consumers. Review source
diffs before overwriting installed files. There is no auth integration, automatic
translation, scheduled publishing, comment system, or website migration.

## Action confirmations

Successful updates use the shared [action toast](./action-toast.md). Errors stay
with the form. The dependency installs automatically; wrap the persistent host
layout in `ActionToastProvider` to retain confirmations across navigation and
translate its Close label. Existing callback and label props are unchanged.

## Optimistic updates

See the [optimistic action contract](./optimistic-actions.md) for immediate UI
changes, rollback, server-confirmed operations and host callback requirements.
The plugin installs its TanStack Query dependency through `@forge/optimistic-action`.

## Authors, collaboration and account changes

Creation sets the creator as `BlogShared.author`. `BlogEditPage.authors` supplies
eligible choices; the list shows Author and Last modified by separately. Public
components use the publication's author, falling back to its historical editor
only for older documents with no explicit author. Custom SEO and feeds must use
the same attribution.

Use `blogCapabilities(actor, storedAuthorId)` and `canAccessBlog` for the shared
staff policy: staff can read/edit/upload; author or admin can publish, unpublish,
delete or change author; only admins manage categories. A non-null actor means
freshly authenticated, active staff, not any signed-in customer. The host owns
eligibility and repeats permission checks on the server. Use `capabilitiesForArticle`
for table actions and bulk selection. Never substitute the last editor's ID for a
missing author ID when calculating permissions.

`resolveAuthor(context, id, tx)` resolves eligible assignment identities and trusted
account names inside writes. Browser-supplied names are ignored. Existing deleted
identities retain their signature; assignment to a missing identity is rejected.

Configure `resolveAuthorNames(ids, tx)` for current account names on admin and public
reads. It returns only public-safe `{ id, name }` values for the requested IDs and
omits missing accounts. It is batched per response and needs no viewer session.
Renames update bylines in every language without changing published text, revisions,
publication dates or the last editor. Draft reassignment changes management rights;
public languages retain their own author ID until republished. Without this optional
resolver, compatibility callers continue displaying stored signatures.

Before removing an account while keeping its articles, call
`storage.snapshotAuthorName(tx, { id, name })` with its last trusted account name
inside the host's authorized deletion transaction. It updates only matching draft
and published signatures, preserving versions, dates and editors. It does not
remove the account or commit the transaction. The host must check fresh admin
permissions, lock/recheck the account and affected records, then atomically apply
its retention choices and account removal. Do not expose this server-only method
directly as a browser endpoint. Reassignment/deletion still belong to the host's
related-data adapter. Invalidate admin/public blog caches after account renames,
reassignment and deletion; source installation does not configure cache hooks.

Legacy articles remain readable, but direct publication fails with `AUTHOR_REQUIRED`
until an administrator explicitly selects and saves an eligible author. Saving a
colleague's draft without that selection leaves it unconfirmed. The selector starts
empty, so saving unrelated text cannot silently confirm the previous editor.
Use the stored optional author ID in `authorize`; only admins can assign or manage
legacy records under the shared policy. Custom storage adapters must enforce the
same guard. This does not recover unknown historical authors or import Seebach's
site-specific attribution repair. Stop old writers that discard the new fields.

`tests/blog-collaboration.browser.mjs` covers colleague drafts, author/admin
controls and explicit legacy attribution. The storage integration suite verifies
multilingual current names, unchanged publication metadata, transaction rollback,
retained names after departure and public-safe author projections. Run it against
a disposable database; account lookup, cache invalidation and deletion remain host
integrations to verify when adopting the source.
