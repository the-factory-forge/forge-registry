# Support tickets

`supports` provides a shared staff queue for website maintenance: a searchable,
paginated table, short creation dialog and a ticket discussion page. All staff
can view every ticket, post replies and close, cancel or reopen it. Customer and anonymous
accounts are excluded. The companion `supports-storage` persists records in
PostgreSQL and images in private S3-compatible storage.

## Install

```sh
pnpm exec shadcn add @forge/supports @forge/supports-storage
```

Install `@forge/intranet-sidebar` or `@forge/intranet-shell` for the optional
footer link. Use the project's pinned registry namespace and review copied source.
The browser entrypoint does not import the storage companion. Hosts can supply
their own `SupportsClient` without installing storage.

The showroom route `/en/intranet/supports` uses sample records and in-memory files;
reload resets them. Its controls exercise loading, empty, error and delayed
actions. It neither authenticates staff nor delivers requests externally.

## Host routes and navigation

Provide guarded `/intranet/supports` and `/intranet/supports/:id` routes using the
host's existing locale routing. Add the footer item only when this capability is
installed and the current viewer is authorized:

```tsx
footerItems={[
  {
    id: "supports",
    label: labels.support,
    href: supportHref,
    icon: <pluginIcons.supports />,
  },
]}
```

`footerItems` uses existing sidebar navigation semantics and sits above the
profile section. `IntranetShell` passes it through. The host supplies localized
labels, paths, the link adapter and the active pathname.

Use `SupportsPage` with `client`, `tickets`, `total`, controlled `search`/`page`,
their change callbacks, `getTicketHref`, `onCreated` and `onChanged` to refresh the
list after cancellation. After creation,
`onCreated(ticket)` can navigate to its discussion. Use `SupportDetailPage` with
`ticket`, `activity`, `client`, `backHref` and `onChanged`. Both expose `labels`,
`className`, `linkComponent` and `formatDate`; English is the default.

The discussion keeps Close ticket (or Reopen ticket) and Post reply in a sticky
bottom bar. Closing uses danger styling and requires confirmation; canceling
preserves the reply draft. Failed closure keeps the dialog open for retry.

Read through shared query keys in the route loader and component. Include search,
page, ticket and activity cursor in those keys. Search applies to title and
description before the fixed 20-row page; latest activity sorts first. The host
must validate URL search state, reset page when search changes and retain unrelated
parameters and the fragment. Default to empty search/page 1. Live search may
replace history; pagination adds history entries. Reload and Back/Forward must
restore both controls and results.

`client.get(id, cursor?)` returns the ticket and 50 chronological activity entries,
with `nextCursor` when more exist. Accumulate subsequent pages and pass an
`onLoadMore` callback until exhausted. `onChanged` should invalidate/refetch the
ticket and list. Reload activity after a write so comments and status events stay
ordered. Refetch on page entry. Clear private caches on sign-out or lost access;
do not retain denied data behind an error banner.

## Forms and discussion

Creation requires a title (200 characters), Markdown description (5,000) and an
explicit `bug`, `feature` or `support` selection. Replies accept up to 5,000
characters and require text or at least one image. Each submission accepts up to
five PNG/JPEG/WebP/GIF images of 10 MiB each. Images are not cropped.

Descriptions and replies use a Markdown textarea without a preview toggle.
Saved content disables raw HTML and uses sanitized links.
Remote embedded images are suppressed; uploaded attachments are displayed
separately. Code blocks and tables scroll within the content. Do not persist
signed image URLs in Markdown. Local success means the ticket or reply was saved,
not that an external maintenance team received it.

Each row includes View request and Cancel request actions. View opens the
discussion; Cancel sets the distinct `canceled` status and keeps the request and
its history. Closed and canceled rows keep cancellation visible but disabled. Failed
cancellation restores the status and allows retry.

Tickets start `open`. All staff may close, cancel or reopen them; comments leave
the current status unchanged. Canceled uses a neutral gray badge (`bg-muted-foreground/15` and
`text-muted-foreground`); Open remains orange and Closed remains green. Repeated identical status changes add no duplicate
event. Submitted content has no edit/delete actions. Author `{id, name}` snapshots
stay as posted after account renaming or deletion. There are no email notifications
or per-user unread indicators in this version.

Update the UI and storage companion together so `canceled` is accepted by server
validation. Status columns already store text, so no database migration or
reclassification of existing closed requests is needed.

## Server wiring and authorization

Compose the exported tables and the shared `pluginLocks` table in the host's
Drizzle schema, then generate, review and apply an additive migration using the
[persistence workflow](./persistence.md). Installation never applies migrations.
Use a separate host database/schema per site; an S3 prefix is not database tenancy.

```ts
import { createSupportsStorage } from "@/components/plugins/supports/server";

const supports = createSupportsStorage({
  db,
  s3,
  bucket,
  keyPrefix: `${siteSlug}/supports/`,
  resolveActor: async (context) => {
    const session = await freshSession(context);
    if (!session) return null;
    const membership = await lookupSiteMembership(session.user.id);
    if (!membership) return null;
    return {
      id: session.user.id,
      name: session.user.name,
      kind: membership.isStaff ? "staff" : "customer",
    };
  },
  authorize: async (context, permission, ticketId) => {
    return canUseSupport(context, permission, ticketId);
  },
});
```

The session, membership and permission functions above are host adapters. Resolve
fresh, verified staff membership, explicitly excluding customer profiles if
Customers is installed. Better Auth's `user`/`admin` roles alone cannot distinguish
staff from customers. The service refuses missing/non-staff actors even if
`authorize` returns true. This is a site-wide directory: `read` authorization must
be consistent across tickets, not a per-record visibility filter.

Expose request-scoped operations through `supports.client(context)`. The
`SupportsClient` browser contract contains list/get/create/comment/setStatus,
upload/cancelUpload and getAttachment. Keep session resolution, CSRF protection,
transport validation, rate limiting and credentials server-side. Never accept an
actor or arbitrary context from the browser. Denied reads should clear host caches.

For image transport, use a bounded multipart endpoint. The client can pass a
`File`, while the server may call `supports.upload(context, {requestId, name,
contentType, bytes})`. Enforce the 10 MiB request limit before buffering. Never
store file bytes or base64 data in PostgreSQL. The service validates signatures,
size, name and MIME agreement; attachment IDs must belong to the submitting actor
and must not already be claimed. Serve only authorized attachment URLs.

Create/comment/upload retries reuse their original request ID and exact payload.
The service rejects conflicting reuse. Create/comment mutation receipts commit
atomically with their content and attachment claims. Do not automatically retry
a changed payload under an earlier ID. A lost response may mean the first write
succeeded: retry the original operation or refresh the directory before creating
another ticket. Errors expose `INVALID`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`STORAGE` or `STORAGE_NOT_CONFIGURED`, without leaking provider errors.

## Private images and cleanup

Configure a private bucket and a validated `<site>/supports/` prefix. The site
segment is a stable lowercase slug. Object filenames use the shared filename
helper beneath generated ID directories. Missing configuration blocks file
operations before object access while text-only tickets and replies remain usable.

Uploads reserve durable metadata before writing bytes. A failed object write or
database commit leaves a reservation that can be retried or cleaned. Unattached
images are private to their uploader, expire after 24 hours and cannot be posted
after expiry. Posting transactionally changes them to attached; attached files
never expire through this maintenance operation. Temporary reads use five-minute
signed URLs with private/no-store response caching. Signed URLs are bearer access
until expiry; do not log or persist them as canonical references.

Run `await supports.maintenance()` from a trusted host scheduler, for example once
per hour, and alert on its returned `failed` count. Each call examines at most 50
eligible records; run additional bounded calls for a backlog. It rotates failed
records, retries deletion safely and preserves tombstones against late upload
retries. `cancelUpload` marks an unattached image for cleanup before object deletion.
Installation does not create a scheduler. Do not apply a bucket expiry rule to the
final Supports object prefix or remove metadata for failed cleanup.

## Deferred connector contract

Connector source will own credentials, bindings, delivery queues and synchronization
metadata. Core Supports has no provider fields or runtime connector registry.
The agreed second phase allows multiple installed connectors but selects one private
destination per ticket through host routing. Public destinations are excluded.

Ticket creation, replies and close/cancel/reopen actions will synchronize both ways.
Failed delivery must preserve the local request, expose a separate pending/failed
delivery state and offer retry. Connecting a destination must not export old
tickets automatically: an authorized operator selects the backlog. If external
status changes while an older local change is queued, adopt the newer confirmed
status and require a fresh staff action instead of silently replaying stale intent.
Provider webhooks, external authors, loop prevention, relative Markdown links and
private attachment transfer belong to that connector implementation.

## Verification and adoption

Run `node --test tests/supports.test.mjs` and the browser suite at the showroom's
`TEST_BASE_URL`. The storage suite uses disposable databases and buckets on the
existing Blogs PostgreSQL/MinIO fixture:

```sh
docker compose -p forge-supports-tests -f tests/blogs-storage/compose.yaml up -d --wait
pnpm test:supports-storage
docker compose -p forge-supports-tests -f tests/blogs-storage/compose.yaml down -v
```

Ports 55440 and 19040 must be free, or use the already running Blogs fixture.
Tests cover authorization, migrations, byte validation, retries, concurrent writes,
private reads and cleanup failures. No production database or object migration is
performed here. Forge Template/customer adoption and the TC public plugin listing
are separate follow-ups under this task's registry-only scope.
