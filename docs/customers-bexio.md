# Customers–Bexio connector

Link one customer to a Bexio person and optionally a company. Staff can search,
link existing contacts, explicitly create a contact, send saved customer details,
review an import and unlink locally. Several customers may share one company;
a person may belong to only one local customer within a Bexio installation.
Automatic synchronization after saving and bulk import from Bexio are included.
The server companion includes database-enforced person uniqueness and recoverable
customer provisioning. Hosts retain account policy and scheduling.

```sh
pnpm dlx shadcn add @forge/customers-bexio
# Optional production server implementation; includes the browser item:
pnpm dlx shadcn add @forge/customers-bexio-server
```

## Browser composition

Import `BexioContactLinkCard` from `@/components/connectors/customers-bexio` and
place it in `CustomerDetailPage.syncContent`. Supply `sectionHrefs.sync` to make
that existing tab visible. Pass a stable `actions` object implementing
`BexioContactLinkActions`, the `customerId`, controlled `search: { person, company }`
and `onSearchChange(type, query)`. Bind searches to validated host URL parameters.
`onChanged` refreshes host link/directory queries after any successful action;
`onImported` additionally refreshes customer/profile queries after an import.
`canWrite={false}` disables writes in the UI; it does not authorize requests.
Every UI string has an English default in `labels`. Translate server errors at
the host transport when needed. Use the shared action-toast and loading providers
once in the host shell; the connector supplies its own query cache.

The card clears its data when the customer changes. Replacing `actions` discards
the previous connection's cache and confirmations and ignores late mutation
completions. Keep its identity stable during ordinary rerenders.

## Server adapters

Import `createBexioContactClient` and `createBexioCustomerService` only from
`@/components/connectors/customers-bexio/server`. Never import that entrypoint
into browser code. The API client uses native fetch, a ten-second timeout and
validated Bexio responses. It does not log or return credentials or provider
response bodies, and does not automatically retry writes.

```ts
const contactClient = createBexioContactClient({ credentialProvider });
const actions = createBexioCustomerService({
  contactClient,
  linkStore,
  customerAdapter,
  customerImportAdapter,
  host,
});
```

Use the supplied persistence/provisioning adapters below, then implement the remaining contracts:

- `BexioCredentialProvider.getAccessToken()` returns the current installation's
  server-side token. Hosts own OAuth renewal or personal-token rotation.
  `createBexioContactClient` also supplies paginated `listContacts` and
  `listRelations` for bulk import.
- `ForgeCustomerAdapter.getCustomer(id)` validates existence, customer-domain
  membership and scope, returning a normalized `ForgeCustomer`. Supply its language
  explicitly and split postal code/city in the host; the connector never guesses.
- `ForgeCustomerImportAdapter.updateCustomer(id, values, expectedEmail)` atomically
  checks the current email, rejects identity collisions and updates the contact.
  For login email changes, revoke affected sessions and require verification using
  the host auth provider. Reject rather than attaching an unrelated account.
- `BexioContactLinkStore` persists links and sync state. Scope all methods to the
  current installation. `createBexioContactLinkStore` implements this contract with
  database constraints for local customer IDs and non-null person IDs; company
  IDs remain shared. Custom stores must preserve the same guarantees.
- `BexioHostAdapter.authorize(permission, customerId?)` checks the current authenticated actor
  on **every** operation, including authorized agent imports. Search has no customer ID and requires permission to
  read the installation's Bexio contacts. `runExclusive(id, operation)` serializes
  customer writes across all application processes, including other host writers
  and deletion. `id === undefined` is an installation-wide exclusive bulk lock:
  it must exclude other bulk imports AND every individual customer writer.
  A single installation lock for all writes is a valid minimal implementation. An in-process lock is insufficient for multiple
  workers. Do not hold a database transaction open across external requests:
  saved IDs must survive a later provider failure.

Expose an explicit allowlist of actions through authenticated host server routes.
Validate transport inputs and apply session/CSRF protection. The service validates
its inputs and calls the authorization adapter before using customer data, links
or Bexio. Scope credentials, stores and the lock to the same installation.

## Included persistence and account recovery

The server item ships `createBexioContactLinksSchema`,
`createBexioContactLinkStore` and `createBexioCustomerProvisioner`, along with
`customers-storage` and `database`. These are connector implementations, not
requirements for each website to rebuild.

Compose the link schema once with the host's customer membership key:

```ts
export const bexioLinks = createBexioContactLinksSchema(customers);
const linkStore = createBexioContactLinkStore({ db, links: bexioLinks, installationId });
```

Generate and review the host's incremental Drizzle migration before enabling the
store. Unique indexes enforce `(installationId, localCustomerId)` and
`(installationId, bexioPersonId)`, including competing requests and direct database
writers. Null person IDs and shared companies are allowed. Reads and writes stay
within the configured installation. The customer foreign key removes local links
when membership is deleted; remote Bexio contacts remain untouched.

The provisioner reuses Customers storage for identity/profile transactions:

```ts
const provisioning = createBexioCustomerProvisioner({
  ...customerStorageOptions,
  context: actor,
  mapCustomer: (customer) => ({
    localCustomerId: customer.id,
    fullName: customer.name,
    email: customer.email,
    language: defaultLanguage,
    companyName: customer.companyName ?? null,
    phone: customer.phoneNumber ?? null,
    street: customer.street ?? null,
    addressComplement: customer.addressComplement ?? null,
    postalCode: null,
    city: customer.city ?? null,
    countryCode: null,
  }),
});
const customerImportAdapter = { ...provisioning, updateCustomer };
// Pass provisioning as customerAdapter and this composed adapter to the bulk service.
```

`customerStorageOptions` is the existing
[Customers storage configuration](./customers.md): database, actual user/profile
tables, fresh authorization, request headers, transaction-bound auth and invitation
callback. `authForTransaction(tx)` and every auth database hook must use that
transaction. Configure those callbacks for the current host actor; do not pass
client-supplied authority. The mapping supplies host language and address choices;
`updateCustomer` retains the existing atomic expected-email and session rules.

If creation fails between identity and profile writes, or commit fails, the
transaction rolls back both records. Retry can create the complete customer.
If commit succeeds but the response or link write is lost, a fresh bulk service
finds the persisted customer by exact email and finishes linking without creating
another account. Matching rejects unrelated identities and ambiguous emails.
Invitation failure retains the completed account; `resendInvitation(customerId)`
provides authorized manual recovery. No failed operation deletes an account to
compensate for a later error, and no existing non-customer identity is silently
converted. Legacy orphan accounts require ownership review before migration.

## Synchronization and recovery

Push runs explicitly or after a committed host save. Local saved values own the person's full name, email and
non-empty phone, the company name and available billing address fields. Missing
optional address/phone values preserve existing Bexio values. Company email and
phone remain untouched. Person/company relationships are verified remotely.

A push stops for review if the remote email differs from both the current local
email and the last agreed email. Import requires a linked person with a real
email and full name. Review shows the proposed name, email, phone and company;
confirmation refetches the contacts and rejects changed IDs, emails or reviewed
values. Address import is not included. Host account rules remain authoritative.

Each newly created external ID is persisted before another API request. Exact
matches must be linked instead of duplicated. After an uncertain create response,
search and link the existing record rather than assuming the request failed.
A successful person update records its email before the company request, so a
partial failure can be retried without losing the completed step. Failed pushes
retain their links and a safe error. Retry explicitly after resolving the error.
Unlinking and local customer deletion never delete Bexio contacts.

A provider write and a local store write are not a distributed transaction.
Persistence failures require inspecting the saved links and remote contact before
retrying. The host's atomic import must not report success before it commits.

## Automatic synchronization after saving

Call the service's `syncSavedCustomer(customerId)` after the host save has committed:

```ts
const saved = await saveCustomer(values);
return {
  ...saved,
  bexioSyncWarning: await actions.syncSavedCustomer(saved.id),
};
```

The connector pushes the saved values through the same authorized, serialized
sync operation. It returns `null` on success or when no Bexio link exists, and a
safe warning on failure. A Bexio failure never rolls back the host save. Display
that warning and offer the existing explicit sync action for retry. It does not
create an initial Bexio connection, run on every keystroke or start a scheduler.
Do not sync an uncommitted draft or blindly retry a whole customer-creation action.

## Bulk import from Bexio

Create `createBexioBulkImportService` from the server entrypoint with the same
`contactClient`, `linkStore`, `customerAdapter` and `host`, plus a
`ForgeCustomerBulkImportAdapter`. This extends the ordinary import adapter with:

- `findCustomersByEmails(emails)`: normalize exact matches, return customer matches
  or explicit conflicts for non-customer identities; never expose unrelated accounts.
- `createCustomer(values)`: commit the customer identity and profile atomically,
  enforce unique normalized email, return the full customer including language, and
  retain the host's invitation/verification policy. Never provision staff access.

`listLinks()` requires installation read permission. `syncAllContacts()` requires
installation write permission and acquires one installation-wide lock, with no
nested per-customer locks. It imports existing person links first, then unique
email matches, then new customers. A person/company pair creates one customer.
Companies without a clear primary person, multiple-company relationships,
duplicate emails and conflicting accounts require review. Existing login-email
changes remain blocked until individually reviewed. Billing addresses are not imported.

The result includes `created`, `linked`, `updated`, `skipped`, `failed` and up to
100 issue details. It is a partial-progress operation: completed customer/link
writes survive later failures, and retries match existing accounts instead of
creating duplicates. Provider listing failures stop before local writes. Account
creation, link persistence and Bexio are not one atomic transaction; inspect a
failed link and retry after resolving its cause. Keep old and new writers on the
same lock policy during adoption.

Render `BexioSyncAllButton` with `syncAll={directory.syncAllContacts}` and an
`onSynced(result)` callback to invalidate host directory/link queries. The button
shows counts and record issues, rejects duplicate submissions and supports
`canWrite={false}` and translated `labels`. Refresh any mounted contact card after
an external bulk import, for example with a host-owned revision `key`.

## Adopting in The Corner Factory website

The shared service now covers TC's post-save sync and bulk workflow, including
contact/relationship listing. Keep its token, Drizzle and Better Auth adapters.
Wire `host` for staff and authorized agent contexts and remove redundant outer
Bexio locks; do not nest the old lock around an already-guarded service operation.
Preserve local commits when coordinating provider requests.

Update TC's confirmation validator to retain the required `contact` snapshot.
When changing schema imports, explicitly supply language in adapter return values;
TC currently relies on a locale default after account updates. Adopt the supplied
link schema/store and customer provisioner for the built-in uniqueness and recovery
guarantees. Review existing duplicate links before applying its unique indexes.
TC's current role/profile model differs from Customers storage's profile membership;
map existing customers explicitly and preserve site-specific fields. Bind its auth
factory and hooks to the supplied transaction instead of creating an auth account
before a separate profile transaction. Account ownership and session revocation
remain host responsibilities; this is an adoption/migration step, not missing
connector recovery logic.

The shared card accepts customer ID and controlled searches; use `onChanged` and
`onImported` to invalidate TC's existing caches. Source installation includes
shared dependencies: review the differing TC `table-search.tsx` before overwriting.
These changes do not install the connector into TC or migrate its database.

## Origin and validation

Adapted from TC's `src/features/bexio-customers/{contracts,client.server,service.server}`.
The registry retains per-customer synchronization, automatic post-save sync and
bulk import behavior. TC's Drizzle/Better Auth adapters, routes, credentials and
account policies remain in TC.
The portable card uses Forge UI dependencies instead of TC components or URL hooks.
No existing installation is migrated automatically.

See the [Bexio API documentation](https://docs.bexio.com/) for contact endpoints,
scopes, access tokens and rate limits. The mock showcase needs none of them.
Run `node --test tests/connectors.test.mjs`, the connector browser tests and
`node --test tests/persistence/customers-projects.integration.mjs` against the local
PostgreSQL fixture. The latter exercises concurrent links and real Better Auth rollback/retry;
validate a clean shadcn install before adopting. Live credentials and provider
writes are separate host verification work.
