# Drive

`@forge/drive` installs a standalone spaces directory and an embeddable file
browser at `@components/plugins/drive`. It has no customer, project, server,
storage, or authentication dependency. `@forge/drive-storage` is an optional
Node server companion using PostgreSQL 15+ through Drizzle and a private,
unversioned S3-compatible bucket. TC migration is separate.

## Install and entrypoints

Configure the `@forge` namespace as described in the root README, then run:

```sh
pnpm dlx shadcn@4.19.1 add @forge/drive
# Optional; also installs the browser contract transitively:
pnpm dlx shadcn@4.19.1 add @forge/drive-storage
```

Browser exports: `DrivePage`, `DriveBrowser`, their props, `DriveClient`,
`DriveScope`, `DriveSpace`, `DriveEntry`, capabilities, pagination, upload and
label types, `DriveError`, and the default XHR `transferDriveUpload`.
Server exports live **only** at `@/components/plugins/drive/server`:
`createDriveStorage`, `driveSpaces`, `driveEntries`, `driveUploads`, and
configuration/database/transaction types. Never import the server entrypoint
into a client component or bundle credentials with the browser.

## Spaces and composition

A space is identified by `{ type: string, id: string }`. The host defines entity
types, record names, links, and permissions. Each project has its own space.
Customers reach files through their projects; customers have no Drive tab or
separate file space. Records with no files can appear in the directory without
a persisted `drive_space` row.

```tsx
import { DriveBrowser, DrivePage } from "@/components/plugins/drive";

<DrivePage
  client={authenticatedDriveClient}
  getSpaceHref={({ scope }) =>
    `/drive/${encodeURIComponent(scope.type)}/${encodeURIComponent(scope.id)}`
  }
  linkComponent={RouterLink}
/>;

const browser = (
  <DriveBrowser
    client={authenticatedDriveClient}
    scope={{ type: "project", id: project.id }}
    parentId={validatedFolderId ?? null}
    getFolderHref={(folderId) =>
      `/projects/${project.id}/drive${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}`
    }
    linkComponent={RouterLink}
  />
);
<ProjectDetailPage {...projectPageProps} driveContent={browser} />;
```

Customers keep their About/Projects/Sync tabs. Their Projects tab can link to a
project's Drive section. Other plugins can embed the same browser with their own
scope; the reusable Drive contract remains independent of projects and customers.
Validate customer-context return links against the project's actual owner in
the host adapter.

All labels, including validation messages and count formatters, can be replaced
via `labels`. Use `locale` for file sizes and dates; dates use UTC for consistent
SSR. Use `className` and the host's semantic theme tokens. Navigation defaults
to the Link shim. No router, query, auth, or notification library is needed.

## Authenticated transport

`DriveClient` is the boundary between the UI and persistence. Implement its ten
methods with your framework's authenticated API or server functions. Forward
read `AbortSignal`s to fetch, validate JSON inputs at the API boundary, enforce
CSRF protection for cookie-authenticated writes, and construct a fresh
`storage.client(context)` from the **server's verified session** for each request.
Never accept a client-provided user, permission set, or server method name.
Use an explicit route/operation allowlist. Do not publish maintenance as a
user-accessible operation.

```ts
// Host-only server route (outside registry-managed files).
const context = await requireSession(request);
const input = parseCreateFolderRequest(await request.json());
await storage.client(context).createFolder(input);
return Response.json({ ok: true });
```

A browser adapter for that operation looks like:

```ts
async function createFolder(input: Parameters<DriveClient["createFolder"]>[0]) {
  const response = await fetch("/api/drive/folders", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const { code } = await response.json();
    throw { code }; // Return only validated DriveError codes from the server.
  }
}
```

Map `DriveError.code` to a suitable HTTP status and return a small JSON error.
Do not send SDK errors, SQL, object keys, credentials, or signed URLs to logs or
notifications. Host callback failures should be logged privately and sanitized.
The browser translates recognized error codes and shows a generic message for
unknown failures. A failed operation remains retryable; names and upload files
stay in memory. Folder/space navigation aborts active transfers and abandons their reservations.
Finalization that has already started can finish; the UI disables cancellation
during that step. Files are not persisted in browser storage. The host controls fetching accessible spaces
and pagination; folder pages use 50 entries and current-folder substring search.

## Database and storage setup

Copy the shipped `server/migration.sql` into the host's migration workflow and
apply it once. Installation does **not** migrate a database. Alternatively,
include the exported table definitions in the host Drizzle schema and generate
a reviewed migration. The three tables retain spaces, entries, and upload
idempotency records. A composite parent foreign key prevents cross-space parent
relationships; names are unique within a folder, including its root. Names are
case-sensitive. Do not write these tables directly from application features.

```ts
// Host-only module. Import this only from server routes and maintenance jobs.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { S3Client } from "@aws-sdk/client-s3";
import { createDriveStorage } from "@/components/plugins/drive/server";

const db = drizzle(
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    connection: { statement_timeout: 60000 },
  }),
);
const s3 = new S3Client({
  region: process.env.S3_REGION!,
  // For compatible providers, configure endpoint and forcePathStyle as required.
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
  // Credentials from the server's IAM role or normal AWS credential chain.
});
export const storage = createDriveStorage({
  db,
  s3,
  bucket: process.env.DRIVE_BUCKET!,
  maxFileBytes: 100_000_000,
  resolveScope: async (context: Session, scope) => {
    const entity = await findAccessibleEntity(context, scope);
    if (!entity) return null; // Deny absent or inaccessible records alike.
    return { scope, name: entity.name, href: entity.href, capabilities: entity.drivePermissions };
  },
  listScopes: async (context: Session, { search, cursor, limit }) =>
    listAccessibleEntities(context, { search, cursor, limit }),
});
await storage.verifyBucket();
```

The host must supply both callbacks. The service re-resolves access for every
operation and again after acquiring a space lock. Listing accessible entities
must return paginated results and omit inaccessible records. All entry IDs and
parents are checked against the authorized space. Capabilities shown in the UI
are descriptive; they never authorize a server operation.

Keep `bucket` and `keyPrefix` stable after the first upload; changing either requires an explicit storage migration.

Use a dedicated **unversioned** bucket with public access blocked, private
objects, and no public website endpoint. Versioning, including suspended
versioning, is rejected because this version's permanent deletion does not
manage object versions. Restrict server IAM access to the configured prefix:
`GetBucketVersioning` on the bucket, and `PutObject`, `GetObject`, `DeleteObject`
on its staging/final prefixes (copy requires read on source and write on target).
The deployment operator separately applies CORS and lifecycle policies. Configure
server-side encryption and retention according to the host's requirements;
Object Lock/retention that prevents deletion is incompatible with this workflow.

Review `server/cors.json`: replace the example origin with your exact website
origins. Allow PUT with Content-Type/If-None-Match and browser-generated
Content-Length; allow GET/HEAD as required. Review `server/lifecycle.json`:
expire **only** `drive/staging/` objects after one day. If `keyPrefix` changes,
change this lifecycle prefix too. Never expire the final `drive/objects/`
prefix. For AWS, apply with `aws s3api put-bucket-cors` and
`put-bucket-lifecycle-configuration` using the respective JSON files; merge
existing rules rather than replacing unrelated policy. Compatible providers may
use an equivalent global CORS configuration. The harness uses MinIO's CORS setting.

## Transfer and recovery semantics

Files default to a maximum of 100,000,000 bytes; `maxFileBytes` can be 1 through
5,000,000,000 for a single PUT/copy workflow. No multipart or resumable upload is
included. The browser runs two transfers concurrently and uses XHR progress.
`transferUpload` can replace the transfer for tests or a host-specific transport;
it receives the reservation, File, AbortSignal, and progress callback.

Preparation reserves a name and returns a conditional, length-bound presigned
PUT URL valid for at most ten minutes. A reservation expires after fifteen
minutes. Use the **same UUID requestId** and identical input when retrying.
Retries do not extend the reservation. Completed request IDs remain tombstones,
including after file deletion, so a delayed response cannot recreate a file.
An expired/cancelled reservation requires selecting the file again. Names are
metadata; generated UUID keys contain no names or entity paths.

Completion checks permissions, parent state, expiration, exact stored length,
content type, and the configured limit, then copies the staging object with an
ETag condition to its final key. Only then does the database expose the file.
A failed copy or commit leaves a retryable reservation; cancellation/expiry
cleans both keys. Final bytes are immutable once published. Rename only changes
metadata. Download authorization returns a five-minute signed attachment URL,
never a permanent public URL. These URLs are bearer credentials and can remain
usable until expiry even if access is later revoked.

Deletion previews count affected files and folders (including the selected
folder and unfinished reservations). The confirmation token detects changed
contents. Deletion first commits a deleting subtree, then removes objects and
metadata from leaves upward. Writes into that subtree are blocked. Storage
failures keep cleanup metadata and return `DELETE_PENDING`; explicit retry or
maintenance finishes it. Large trees may need multiple bounded passes. Metadata
and SQL work for marking a subtree scale with that subtree. Per-space advisory
locks serialize mutations and storage finalization; inject bounded SDK timeouts
and size the host pool accordingly. This is intended for ordinary business-file
spaces, not unbounded concurrent ingestion.

## Entity deletion and maintenance

Do not cascade customer deletion into project spaces or assume another plugin's
relationships. Block entity removal while its own Drive space contains files,
folders, reservations, or unfinished deletion. Remove its contents explicitly.
`assertSpaceEmpty(context, scope)` is useful for showing a message, but a separate
check and write is **not** an atomic deletion guard.

When the entity lives in the same PostgreSQL database, use the optional callback
on `deleteSpace` to remove the empty space and entity under the same transaction
and scope lock:

```ts
await storage.deleteSpace(context, { type: "project", id }, async (tx) => {
  // Use this transaction, not an independent pool/transaction.
  await tx.delete(projects).where(eq(projects.id, id));
});
```

The callback runs only for an empty space. New writes waiting on that scope lock
recheck entity existence after the transaction commits. For records in another
service, the host must first revoke writes with a durable entity-deleting state,
then delete contents/space and remove the entity. Ensure `resolveScope` rejects
that state. Never reuse a deleted entity ID for an unrelated record.

Run bounded maintenance from a trusted host job, for example once per minute:

```ts
const result = await storage.maintenance({ limit: 100 });
if (result.failures) logger.warn("Drive maintenance needs retry", result);
```

Each call attempts at most `limit` expired reservations/deleting entries (1–1000).
Repeated runs drain larger backlogs. Monitor failures and schedule another pass;
no hosted worker or automation is installed. Lifecycle expiry is still mandatory:
a previously signed staging URL can be replayed after cancellation or completion
until it expires. Maintenance cannot see a replay that arrives after cleanup.
Upload tombstones intentionally remain until the empty space is explicitly
removed; include them in retention/capacity planning. Back up the database and
final objects together and test restoration.

## Showroom and integration tests

`/en/drive` lists project spaces and a generic workspace example. Project Drive
and the standalone browser share the same in-memory store. **Drive integration**
can hide the embedding; **Fail next upload**, **Interrupt next deletion**, directory
states, and the failure checkbox exercise retries and errors. The team handbook
is read-only. Demo data resets on reload and uses no real storage.

The isolated harness uses fixed localhost ports 55439 (PostgreSQL) and 19039
(MinIO), development-only credentials, named test volumes, and a dedicated bucket.
It never reads TC environment files, databases, or buckets. Docker and Node 24+
are required. The pinned MinIO image is for local integration testing.

```sh
docker compose -f tests/drive-storage/compose.yaml up -d --wait
pnpm test:storage
docker compose -f tests/drive-storage/compose.yaml restart
docker compose -f tests/drive-storage/compose.yaml up -d --wait
DRIVE_TEST_PHASE=restart pnpm test:storage
# Remove only this harness and its test data when finished:
docker compose -f tests/drive-storage/compose.yaml down --volumes
```

The normal storage test resets **only the harness database and bucket**. Restart
mode verifies a previously written file without resetting data. Browser tests
use `TEST_BASE_URL` and cover the mock showroom; storage tests use real signed
transfers and fault injection. Run `pnpm test`, `pnpm test:browser`, registry
checks, typecheck, combined checks, and the production build for changes.

Public sharing, previews/editors, file moves, version history, restoration,
folder uploads, and multipart/resumable transfers are outside this version.
Keep host transport, auth, schema migrations, scheduling, and entity adapters
outside registry-managed paths. Registry updates copy source; inspect the diff,
review migrations, and validate host integrations before deploying an update.
