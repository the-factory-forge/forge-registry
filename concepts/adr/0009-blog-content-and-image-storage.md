# ADR-0009: PostgreSQL blog content and S3 images

## Status

Accepted on 2026-10-10 by the owner for the registry, template guidance and clinic.
Reconciled on 2026-10-26 with the implemented localized history and Drizzle
persistence. Simplified on 2026-10-28 to one draft per language.
This is a registry-owned decision; consumer adoption is separate.

## Context

The shared blog companion stored Markdown revisions and images in S3, while the
clinic stored both in PostgreSQL. The owner selected one shared companion to reduce
custom persistence code while keeping article text with its transactional metadata.
The owner confirmed that no website used the former S3 Markdown flow; a migration
for that unused format is unnecessary.

## Decision

Store current draft/publication Markdown in PostgreSQL JSONB article documents
and complete localized snapshots in the separate, indexed `blogs_history` table.
Keep five publications, including live, and one saved draft per language, with
stable publication numbers. Drafts display their translated label, while internal
snapshot allocations remain separate from publication numbering. Changed saves replace the draft; resumed historical
content becomes a new draft before publication. Publishing preserves newer
publications and prunes only the oldest when the limit is exceeded. Header lists load no snapshot bodies;
selected bodies load on demand after authorization. Retained text remains private.

Use the existing transaction and plugin lock for article changes, history,
retention, query projections and small idempotency results. Resumption confirms
replacement of a saved draft before editing; only successful Save replaces it.
History publication rechecks a version-bound plan and confirms missing-image
omission when needed. Limit pruning removes the oldest publication automatically. Failure
preserves live content and history. Designated authors remain separate from
saving actors; current article ownership governs management, while trusted name
resolution and account-deletion transactions maintain captured signatures.

S3 holds uploaded image bytes only, following the shared
[user-upload persistence contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/host-integration/spec.md#requirement-user-uploaded-file-persistence).
Text-only operations do not contact S3.
Current drafts, publications and retained snapshots protect image references
without copying objects per version. Publication verifies the images it will
serve. An explicitly confirmed missing historical illustration may be omitted
from the effective public projection while its source snapshot retains the
original reference. Foreign assets remain forbidden; timeouts, access errors
and missing buckets remain failures to retry. Cleanup requires the final
reference to disappear and the existing grace period to expire.

The owner confirmed no existing history data requires migration for the one-draft
change; it reuses the schema.

Hosts compose the exported Drizzle schema and generate their own additive
migrations. With incompatible writers stopped, run history backfill followed by
query-projection backfill in the reviewed migration transaction. Seed only actual
current states, sharing an identity for identical draft/publication inputs;
preserve existing content, IDs, signatures and publication metadata. Repeating
backfill is a no-op. Migration-journal and Blogs readiness checks precede service
startup. Installation runs no migration and invents no earlier history.

Hosts own S3 credentials, site/plugin prefixes, authorized transport, cache
invalidation, migration commands, scheduled cleanup and backups of both stores.
Rollback retains additive schema/data and compatible writers; downgrading to a
writer that discards history or localized settings is unsafe.

## Alternatives and consequences

Storing all bytes in PostgreSQL keeps one backup but grows the database with images.
Storing article text in S3 adds cross-store coordination to every text save and read.
The selected split keeps text atomic with its metadata and reuses shared image storage.
Keeping history in each article document would amplify ordinary reads and rewrites;
separate bounded rows avoid that cost. Full snapshots still consume database space,
and retained references extend image lifetime. Retention caps do not replace backups.
Existing database-image hosts need a verified transfer that preserves IDs and source
bytes; the template keeps Blogs optional rather than installing it for every site.

## Evidence and verification

Reconciled against Registry commit `2ef9a09ff6e9c54756021ff2af76876011584d40`.
See [the persistence requirement](../../openspec/specs/plugins/spec.md#requirement-blog-content-and-image-persistence),
[localized history](../../openspec/specs/plugins/spec.md#requirement-complete-localized-blog-history),
[history migration and rollback](../../docs/blogs.md#history-migration-and-rollback)
and [startup checks](../../docs/persistence.md#required-startup-checks).

The [model](../../registry/components/plugins/blogs/model.ts) owns retention and
publication planning; the [storage companion](../../registry/components/plugins/blogs/server/storage.server.ts)
implements transactional persistence, authorization and image verification.
[Model tests](../../tests/blogs.test.mjs) and the
[history integration suite](../../tests/blogs-storage/history.integration.mjs)
cover those contracts; links to tests are not evidence of a fresh integration run.

The earlier [storage handoff](../../docs/HANDOFF-blogs-storage.md) records the
original adoption context. Host migrations and deployment require separate
evidence; this reconciliation does not certify any consumer's installed state.
