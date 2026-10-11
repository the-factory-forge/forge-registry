# HANDOFF: blog Markdown in PostgreSQL, images in S3

Use this handoff from a consuming website's chat, including a website that installs
all Forge plugins. Scope the update to Blogs and its host adapters; preserve other
plugins, local edits, routes, authorization, translations and customer design.

Suggested invocation:

> Follow forge-registry/docs/HANDOFF-blogs-storage.md for this repository. Install
> the image-only S3 blog companion, preserve existing articles and image URLs, and
> verify the blog journeys. Prepare deployment migration commands without running
> them against production.

## Target and source

`@forge/blogs-storage` keeps full draft/publication Markdown in `blogs_article.document`.
Only uploaded image bytes go to private S3. The `BlogsClient` contract and stable
image IDs remain unchanged. PostgreSQL also owns categories, versions and retry
records. `storage.maintenance(100)` cleans unreferenced image objects after the
existing 24-hour grace period.

The owner confirmed on 2026-10-10 that no website used the former S3 Markdown flow.
There is no legacy Markdown migration or runtime fallback. If inspection finds real
S3-only article bodies, report that unexpected data before replacing that installation.

This change is initially unpublished, based on registry commit
`5b20fad722488e78db0d707c25c6bfaf22171b32`. Before a remote install, resolve a commit
that actually contains this handoff and the updated `public/r/blogs-storage.json`;
record that SHA in the consumer. Do not install the base commit as the new version.
For local adoption, rebuild with `pnpm registry:sync`, serve `public/` on a free
local port, and use a temporary `@forge` namespace pointed at that server. Record
that the source is unpublished and restore the consumer's original namespace.

## 1. Inspect the consumer

Read its `AGENTS.md`, environment schema, installed blog source, authenticated
transport, public loaders, schema and migration history. Never read secret env
files; use the host's sanitized environment validation. Record the original branch,
uncommitted files, registry pin and actual storage implementation.

Distinguish an empty/new blog installation from a custom database adapter containing
articles and binary images. The latter needs section 3. An installed SDK or a
marketing page listing Forge plugins does not establish actual storage usage.
Every existing draft and publication must be accounted for. Do not reset databases
or replace applied migrations.

## 2. Install and preserve integration

Use the host's shadcn command, normally `vpr ui add @forge/blogs-storage`. Preview
potential overwrites or install into a temporary consumer first. Relocate server
files into the host's intranet boundary and adapt aliases; preserve Link/Image
adapters, labels, navigation, query invalidation, origin checks, body limits and
fresh server authorization. Keep server exports out of browser imports.

New installations review `server/migration.sql` and add its tables through the
host's migration workflow. Existing installations generate only the needed
incremental changes; never apply fresh CREATE TABLE statements over existing tables.
Review the image-only `blogs_object.kind` constraint if reusing an empty old schema.

Use `getS3StorageConfig("blogs")` with the site's stable bucket and required
`<SITE_NAME>/blogs/` prefix. Missing, site-only and unscoped prefixes are rejected.
The bucket must be private and unversioned; credentials need object permissions and
bucket versioning read permission. No browser-to-S3 upload route is required.
Existing S3 image keys must not change.

## 3. Migrate a custom database image adapter

1. Back up PostgreSQL and the destination blog S3 prefix. Record article/language
   counts, drafts, publications, IDs, versions, authors, dates and image bytes.
2. Add the registry tables with an incremental host migration, retaining the old
   tables. Stop old writers and maintenance before the data transfer and cutover.
3. Preserve complete article documents, category IDs, publication state and image
   IDs. Upload each database image to a deterministic key under the site's `blogs/`
   prefix; verify downloaded bytes and MIME type before committing its object row.
   Never overwrite an existing object whose bytes differ.
4. Make retries safe, refuse an already-populated destination, and record completion
   durably so rerunning cannot resurrect articles later deleted in the new app.
   Preserve old request IDs as conflict tombstones when their format is incompatible.
5. Compare all source/destination data, including unpublished changes and different
   languages. Keep original database bytes until cutover and backup verification
   are complete. Switch the host's reads and writes together; retain stable image
   routes and any site-specific optimized static photos.

The clinic's `scripts/migrate-blog-storage.mjs` implements this for its `blog_*`
schema. Inspect another host's actual schema before reuse. The clinic's
`vpr blogs:migrate-storage` is an explicit operator step after its incremental SQL
migration and before starting the new application; it is not a startup seed.

Before accepting new writes, rollback can restore the prior app and database
backup. After new writes, stop editing and reconcile those writes before recovery;
simply reverting code would expose stale article data.

## 4. Verify and finish

- Use disposable PostgreSQL and S3-compatible services to prove transfer failure,
  retry and completion behavior; compare all article/translation/image data.
- Prove new saves create no `.md` objects and store Markdown in PostgreSQL. Text-only
  reads, saves and publication must work while S3 is unavailable.
- Exercise authenticated image upload, reload persistence, private draft images,
  published images, publish/unpublish, stale versions and duplicate requests.
- Verify existing public URLs, translated slugs, metadata and responsive originals.
  Deletion removes visibility immediately; byte cleanup follows the grace period.
- Run the host's lint/type checks and affected browser suite. Record actual results.
- Schedule `storage.maintenance(100)` through a trusted server job and back up both
  stores. A database-only backup no longer contains newly uploaded image bytes.
- Update host integration notes and `forge-spec/consumers/sites.yaml` with the
  adopted revision, deployment steps and any other consumers still pending.

Report source adoption separately from production migration. Do not claim the
feature is deployed or migrate a live database as part of testing.
