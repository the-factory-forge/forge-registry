# Persistence verification

The fixture composes all persistence companions with forge-template's auth and
agent-key schemas at `1ed3eb20962adcf9235b5f35ac74a405f8f216e7`. These copies are
test-only; production Customers receives the host's actual user table.

Start the existing local fixtures from the registry root:

```sh
docker compose -p forge-drizzle-drive -f tests/drive-storage/compose.yaml up -d --wait
docker compose -p forge-drizzle-blogs -f tests/blogs-storage/compose.yaml up -d --wait
docker compose -p forge-drizzle-menus -f tests/menus-storage/compose.yaml up -d --wait
docker compose -p forge-drizzle-reservations -f tests/reservations-storage/compose.yaml up -d --wait
pnpm test:storage
pnpm test:blogs-storage
pnpm test:menus-storage
pnpm test:reservations-storage
pnpm test:persistence
pnpm test
pnpm typecheck
```

`test:persistence` uses an isolated schema in the Drive test database and a
disposable Blogs database, removing both afterward. The composed fixture generates migrations with the pinned
Drizzle Kit API, applies them through the Drizzle migrator and verifies repeat
execution preserves users, credentials and sessions. Real Better Auth admin APIs
exercise identity/profile atomicity, auth-hook rollback, duplicate email, invitation
failure, employee membership, project ownership and restricted deletion. Tests
never send mail; the host invitation callback is a local delivery spy.

Storage suites create fresh databases from the current registry schema exports
using the pinned Drizzle Kit API. Historical database schemas and SQL migrations
are not retained; upgrades from previous database layouts are outside this test scope.
Menu defaults and constraints are checked against the generated current schema.

`schema.types.ts` is compile-only coverage for inferred records and actual host
transaction/auth compatibility. `tests/persistence.test.mjs` rejects handwritten
runtime SQL and checks schema-only distribution. Runtime SQL in test setup is intentional.

`blog-startup.integration.mjs` uses a disposable database with its real `public`
schema and migration journal. It generates the current composed schema, checks
that startup rejects a pending migration, then applies it through Drizzle's migrator.
After seeding credentials/sessions, Drive records and blog documents/history/images,
it verifies that replay preserves data and the single journal entry. Editing applied
SQL or leaving blog projections incomplete blocks startup. Projection repair is
repeatable and preserves documents, history and object keys without touching objects.

Customer regressions cover manual resend after losing the creation response,
invitation preservation on profile-only edits, bounded pages and per-record
authorization including empty pages with continuations. The Drive suite checks
a wide subtree, bounded query parameters/results and rollback after a later
mutation batch fails.
