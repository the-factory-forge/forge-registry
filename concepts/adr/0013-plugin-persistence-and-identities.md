# ADR-0013: Plugin persistence and customer identities

## Status

Accepted on 2026-10-23. Registry implementation decisions split from
[shared ADR-0013](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0013-project-owned-drizzle-persistence.md)
on 2026-10-26. The shared decision retains project schema and migration ownership.

## Context

Plugin persistence needs typed transactions, coordinated concurrent writers and
bounded directory queries. Customer accounts must share authentication with the
host without granting employee access or leaving orphan identities.

## Decision

Use persistent named row locks for plugin concurrency. Keep existing lock scopes,
including Menus/Drive image operations, and stop old advisory-lock writers before
enabling replacements. Large Drive subtree reads and mutations use bounded batches
under one scope lock and transaction; failure rolls back the whole mutation.

Retain blog document/history payloads and update queryable projections atomically.
Backfill before enabling new queries and require Blogs readiness before serving
traffic or starting workers. The host also checks its migration journal under the
shared contract. [ADR-0009](0009-blog-content-and-image-storage.md) owns the detailed
history, image-lifetime and rollback decision.

Customers are Better Auth identities with one-to-one profiles, using existing
admin/user roles. Profile membership distinguishes customers from employees;
host guards and employee adapters must enforce that distinction. Require a real,
unique email and commit identity and profile through one transaction-bound auth
adapter, including its database hooks, before sending a single-use invitation.
Delivery failure or a post-commit process crash leaves a recoverable account.
Manual administrator resend is the default; guaranteed eventual delivery requires
a host-owned outbox. Profile-only edits do not invoke identity security hooks.
Projects belong to customer profiles and restrict their deletion. Host adapters
retain routing and site-specific behavior.

Customer and project directories return bounded, authorized pages and may return
an empty page with a continuation cursor. They do not scan the entire directory
to fill a page or expose an unfiltered total. Hosts own URL paging and reset it
when search, ownership or mutations change the result set.

## Alternatives and consequences

A customer auth role would change inherited authorization unnecessarily.
Profile membership preserves roles but requires explicit guards and employee
exclusion before counts and pagination. Existing email-less contacts require a
separate adoption decision; do not convert them or assign placeholder addresses.

No mixed-lock rolling cutover is safe. Generated migrations need review, explicit
backfills and compatible rollback writers. Batching bounds database predicates;
it does not make full deletion previews or host callbacks automatically bounded.
Installing source never migrates data or updates a running consumer.

## Evidence and verification

See [typed persistence](../../openspec/specs/plugins/spec.md#requirement-typed-plugin-persistence),
[customer transactions](../../openspec/specs/plugins/spec.md#requirement-customer-identity-and-profile-transactions),
[bounded directories](../../openspec/specs/plugins/spec.md#requirement-bounded-customer-and-project-directories)
and the [persistence guide](../../docs/persistence.md).
The [customer/project integration suite](../../tests/persistence/customers-projects.integration.mjs)
records executable transaction and membership cases. This split was reviewed
against Registry `9a36e9b`; no database integration suite was rerun for it.

The original [change](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/changes/archive/2026-10-23-standardize-drizzle-persistence/proposal.md)
remains in forge-specs. Source and fixture evidence do not certify production
migration or customer adoption.
