# Blogs

`@forge/blogs` provides administration, a Markdown editor with a live TanStack
Markdown preview, category management, and public listing/article components.
`@forge/blogs-storage` adds private S3 and PostgreSQL persistence. Neither item
depends on customers, projects, or Drive.

## Install and compose

Configure the `@forge` namespace as described in the repository README, then:

```sh
pnpm dlx shadcn@4.19.1 add @forge/blogs
# Optional persistence companion, including the UI item:
pnpm dlx shadcn@4.19.1 add @forge/blogs-storage
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

An article groups linked translations. Each has its own title, slug, summary,
Markdown, image alternative text, draft, and publication. Thumbnail, banner, and
category assignments are shared. Publishing one language captures the current
shared settings for that language only; other live translations remain unchanged.

Save drafts explicitly before switching language or publishing. Failed saves and
ordinary prop rerenders preserve local values. Switching articles resets the
form. The host owns navigation; add its router's unsaved-change guard if protection
against leaving the editor entirely is required.

Editor IDs/names come from authenticated server context and dates from the server.
Saving and publishing record the acting editor. Public credit comes from the
publication, never a later unpublished draft. The original publication date stays
stable across updates; publishing after an unpublish starts a new publication date.

Slugs use lowercase ASCII words separated by hyphens and are unique per language.
Titles do not automatically change existing slugs. Explicit slug changes take
effect when published; the host owns redirects. Unpublished/missing translations
have no public language fallback.

Categories form one translated tree with at most two levels. Selecting a child
also selects its parent; parent filters count each article once. Category slugs
are unique per language. Publication requires names in that language for every
selected category. Existing labels cannot be removed. Categories in use cannot
be deleted or reparented; parents with children cannot be deleted. Reassign drafts
and republish affected translations before deleting a category.

## Persistence and migrations

The companion exports `createBlogsStorage`, configuration/database types, and
`blogsArticles`, `blogsCategories`, `blogsObjects`, and `blogsMutations` Drizzle
tables. Review `server/migration.sql` and apply it through the host migration
workflow. Installation does not apply migrations.

Use a private, dedicated, **unversioned** S3-compatible bucket. Versioned/suspended
buckets are rejected because deleting current objects leaves previous versions.
Configure credentials on the server only:

```ts
import { createBlogsStorage } from "@/components/plugins/blogs/server";

const storage = createBlogsStorage<HostRequestContext>({
  db, // Drizzle PostgreSQL database
  s3, // AWS SDK v3 S3Client
  bucket: process.env.BLOGS_BUCKET!,
  locales: ["en", "fr"],
  keyPrefix: "blogs/",
  authorize: async (context, permission, articleId) =>
    hostCanAccessBlog(context.session, permission, articleId),
  resolveEditor: async (context) => ({
    id: context.session.user.id,
    name: context.session.user.name,
  }),
});
```

The host must implement real authorization for `read`, `create`, `edit`,
`publish`, `delete`, `upload`, and `manageCategories`. Grant `read` with write
permissions so mutation responses can return the refreshed article. Administrative
listing checks both list-level and per-article permissions. UI capabilities hide
controls but never authorize server operations.

PostgreSQL stores metadata and publication snapshots as atomic JSONB documents,
without Markdown bodies. S3 stores immutable revision objects ending in `README.md`
and generated image keys. Object reservations are committed before writes so a
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

Defaults are 10 MiB per image and 1 MiB per Markdown document. The companion checks
these limits again on the server. When overriding `maxImageBytes` or
`maxMarkdownBytes`, pass matching values to the editor/public components and
override the image-limit hint label. The companion checks
byte length, MIME type, and JPEG/PNG/WebP signatures. SVG and other formats are
rejected. Signatures are not a full image decoder; optional transcoding/scanning
belongs in the host pipeline. Browser-to-bucket CORS and presigned uploads are
unnecessary because transfers use the host endpoint.

## Public pages and images

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

All unreferenced objects, including those of deleted articles, have a 24-hour grace
period to outlive interrupted transfers; attach uploads to saved
drafts within that period. All current draft/publication references protect objects.
Article deletion immediately removes public visibility and leaves the object
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
