# Plugin persistence

Each project owns one PostgreSQL database, one composed Drizzle schema and its
committed migration history. Registry companions use Drizzle 1.0.0-rc.4 and
Postgres.js. Import their server entrypoints only from host server modules;
browser pages keep using callbacks or the existing client contracts.

## Compose the schema

Export only installed tables from the host's existing schema index. Include
`pluginLocks` once whenever a persistence companion is installed. Customers must
receive the actual Better Auth user table; Projects receive that customer table.

```ts
export * from "./auth.schema";
export * from "./agent-key.schema";
export { pluginLocks } from "@/components/utils/database";
export * from "@/components/plugins/drive/server/schema";
export * from "@/components/plugins/blogs/server/schema";
export * from "@/components/plugins/menus/server/schema";
export * from "@/components/plugins/reservations/server/schema";
import { createCustomersSchema } from "@/components/plugins/customers/server/schema";
import { createProjectsSchema } from "@/components/plugins/projects/server/schema";

import { user } from "./auth.schema";

export const customers = createCustomersSchema(user);
export const projects = createProjectsSchema(customers);
```

The example composes every companion; remove exports for features the host does
not install. The template default remains Auth and Employees. The disposable
`tests/persistence/schema.ts` fixture composes every companion with a copy of the
template's auth schema without changing the template default.

Use `drizzle({ client: postgres(connectionString), relations })` with the host's
existing Relations v2 configuration. `PluginDatabase` and `DatabaseTransaction`
accept hosts with additional tables/relations. Deletion guards and author-retention
callbacks can use typed `select`, `insert`, `update` and `delete` on the supplied
transaction. Do not use the outer database from inside a transaction callback.
Schema exports include inferred record types; no asserted raw-query rows are needed.

## Generate, review, migrate

1. Pin `drizzle-orm` and `drizzle-kit` to `1.0.0-rc.4`, preserving the project's
   Postgres.js connection and database identity. If migrating pre-1.0 Kit history,
   run the pinned Kit's `up` command and review its format conversion; retain
   every applied migration's SQL and ordering.
2. For auth configuration changes, generate a candidate with the host's pinned
   Better Auth CLI. Reconcile intended fields and Relations v2 definitions into
   the existing auth schema, preserving host additions. The template's
   `auth:generate` writes `.cache/auth.schema.generated.ts` for review. Do not
   overwrite the schema index or use Better Auth to register business tables.
3. Run `pnpm db:generate`, review the generated SQL and snapshot, and commit the
   project migration with the source change. Review explicit data backfills too.
4. Run `pnpm db:migrate` in the intended environment when authorized. Installation
   never applies migrations. Re-running migration execution uses the journal and
   must preserve existing rows; do not rerun individual creation scripts.

This follows the [Better Auth adapter workflow](https://better-auth.com/docs/adapters/drizzle)
and [Drizzle generation workflow](https://orm.drizzle.team/docs/drizzle-kit-generate).
Application reads/writes use the typed query builder. Handwritten SQL is limited
to schema definitions and reviewed migrations/backfills. Mailing has no database;
employee identity operations stay on Better Auth backed by Drizzle.

## Existing-host cutover

Back up and inspect the actual host schema/history first. Registry source is not
a migration baseline. The registry tests initialize fresh databases from current
Drizzle schemas; historical schemas and SQL upgrade fixtures are not retained. For a
database originally created manually, reconcile/baseline its existing tables with Kit's reviewed introspection
workflow before generating additive changes. Never replay a fresh schema over it.

Stop **all old writers and workers** during cutover. Advisory locks and row locks
do not coordinate. Add the common `forge_plugin_lock` table and keep its rows
permanently. The replacement retains global Blogs/Reservations/menus-taxonomy
scopes and per-space Drive scopes, including the Menus image scope.

For Blogs, generate the new translation/publication/category tables and the
article author/category and history image-reference columns. With writers still
stopped, run `db.transaction(backfillBlogProjections)` from the server entrypoint.
If adopting history at the same time, first run the existing
`storage.backfillHistory(tx)` in the same transaction, then the projection backfill.
Both are explicit migration work, never startup or browser actions. Verify
documents/history remain unchanged (except an intentionally requested history
backfill), publication listings/counts agree and retained image IDs remain protected.

Reservations adds a generated status column, preserving booking documents,
tokens, notifications and leases. Drive preserves object keys and nullable
storage names; hosts predating trash or storage names must include those additive
fields/indexes. Menus preserves existing items, spice levels, sizes and icons.
Remove `menusPlugin()` from Better Auth configuration and remove its obsolete
installed file; Menus tables now belong exclusively to the composed schema.

Enable new services/workers together only after validation. For rollback, stop
writers again, retain the additive schema/data and use compatible code; do not
reintroduce writers that leave blog projections stale. No customer website,
production migration or object move is performed by a registry source update.

### Required startup checks

After reviewed migrations and backfills, the host must await these checks before
enabling routes or starting workers:

```ts
import { assertMigrationsApplied } from "@/components/utils/database-migrations";

await assertMigrationsApplied(db, { migrationsFolder: "./drizzle" });
await blogs.preflight(); // blogs is the host's createBlogsStorage instance
// Only now enable application traffic and cleanup/notification workers.
```

The journal check compares every local migration's name, timestamp and hash with
the project's existing journal. It rejects missing, pending, edited or unknown
migrations; pass the host's `migrationsSchema`/`migrationsTable` when customized.
It never applies a migration. The template runs this check in `db:preflight`,
production `start` and its Docker entrypoint, after Docker's existing migrate step.
Hosts installing Blogs must also await the blog preflight in their server and
worker bootstrap. Keep the startup command failed when either check rejects.

`blogs.preflight()` verifies all required blog tables/columns, article projections
and retained history-image IDs under the same Blogs lock. It scans bounded batches,
does not repair data and reports a failure until the reviewed backfill is run.
The server entrypoint also exports `assertBlogStorageReady(db)` for a standalone
host check. Blog operations automatically await a successful preflight once per
storage instance, including public reads and image cleanup. A failed instance can
retry after repair. Successful checks are cached for that process, so they do not
make mixed old/new writers safe: stop old writers and create fresh service/worker
instances at cutover. Measure preflight duration against each host's data volume.

Drive's subtree reads and trash/delete mutations use bounded batches within one
scope-locked transaction. A failure rolls back every mutation batch. Full deletion
previews and host `canDelete` callbacks still receive the complete subtree; hosts
must bound any database predicates their callbacks build from that ID list.

## Customer identity boundary

`customers-storage` creates password-free Better Auth users and one-to-one
profiles. Supply a transaction-bound auth factory, including all auth hooks:

```ts
const service = createCustomersService({
  db,
  users: user,
  customers,
  authForTransaction: (tx) => createAuth(tx).api,
  headers: (context) => context.headers,
  authorize: authorizeCustomerOperation,
  sendInvitation,
});
```

The host factory must use `tx` in its Drizzle adapter **and** every database hook.
The template exports `createAuth(database)` for this purpose. Do not return the
global `auth.api` here. Invitations run after commit and must issue expiring,
single-use links; failed delivery returns `invitationSent: false` with the saved
customer, allowing `resendInvitation` without recreating the account. Do not
return credentials or tokens from the service transport.

Manual resend is the default recovery policy. If a process dies after commit but
before delivery, or the creation response is lost, search for the saved email and
call `resendInvitation` on that customer. Do not retry creation as the recovery
step: it correctly rejects the existing email. Delivery status is not persisted
or guaranteed; hosts requiring eventual delivery supply their own durable outbox.
Contact/company/address-only edits leave the identity and outstanding invitation
unchanged. Name/email/verification changes still use Better Auth and its existing
security hooks; email changes reset verification.

Require a real unused email. Creation never attaches an existing identity;
updates preserve account IDs and reset verification when email changes. Existing
email-less website contacts are outside this migration and need a separate
adoption decision. Do not generate placeholder emails or bulk-verify accounts.

Keep the existing `admin`/`user` roles. Customer membership comes from
`customer_profile`, so host route guards must distinguish customers from employees,
even if both have role `user`. When Customers is installed, pass `directory` to
`createEmployeeService`: its `list(offset, limit)` must exclude profiles **before**
counting/pagination, and `contains(id)` must confirm an existing user without a
profile. The service checks the actor and every employee mutation target. Also
guard direct Better Auth admin endpoints, navigation and loaders in the host.
See the real integration example in
[`customers-projects.integration.mjs`](../tests/persistence/customers-projects.integration.mjs).

Projects reference the profile with a restrictive foreign key. Resolve and
authorize ownership on the server; do not trust a browser-supplied customer ID.
The service preserves ownership, URL, poster and assignment on ordinary edits.
Deleting an account/profile with remaining projects fails atomically.

## Bounded customer and project directories

`customers.client(context).list(query)` and
`projects.client(context).list(ownerId, query)` accept
`{ search?, pageSize?, cursor? }` and return `{ items, nextCursor }`.
The default page size is 50 and the maximum is 100. Queries sort by name then ID,
read at most one page plus one lookahead row and authorize only that page's rows.
Neither service scans subsequent pages to fill a page or returns an unfiltered
total. A page can be empty with `nextCursor` present when its candidates are
unauthorized; the host must retain Next in that case.

The cursor is a validated decimal offset, not an identity or an authorization
token. Reauthorize every request. Pages reflect live data, so concurrent inserts,
deletes or renames can move rows between pages. Reset the cursor on search or
owner changes and after mutations. Bind search/cursor to the host URL and include
them in query keys; retain prior cursors for Back/Previous navigation. Pass `items`
to the existing directory UI and compose `TablePagination` without a total.
Do not concatenate every page to recreate an unbounded directory read.

Earlier unpublished adapters using `list(search)` or expecting an array must use
the query object and `result.items`. Existing customer websites are unchanged.
