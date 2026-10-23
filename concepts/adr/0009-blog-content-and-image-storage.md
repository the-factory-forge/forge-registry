# ADR-0009: PostgreSQL blog content and S3 images

## Status

Accepted on 2026-10-10 by the owner for the registry, template guidance and clinic.

## Context

The shared blog companion stored Markdown revisions and images in S3, while the
clinic stored both in PostgreSQL. The owner selected one shared companion to reduce
custom persistence code while keeping article text with its transactional metadata.
The owner confirmed that no website used the former S3 Markdown flow; a migration
for that unused format is unnecessary.

## Decision

Store complete draft/publication Markdown in PostgreSQL JSONB documents. S3 holds
uploaded images only. Keep the editor/client contract, server authorization,
idempotency and publication boundaries. Text-only operations do not contact S3;
image publication still checks the referenced objects. Hosts own S3 credentials,
prefixes, migration commands, scheduled cleanup and backups of both stores.

## Alternatives and consequences

Storing all bytes in PostgreSQL keeps one backup but grows the database with images.
Storing article text in S3 adds cross-store coordination to every text save and read.
The selected split keeps text atomic with its metadata and reuses shared image storage.
Existing database-image hosts need a verified transfer that preserves IDs and source
bytes; the template keeps Blogs optional rather than installing it for every site.

## Evidence and verification

See [the persistence requirement](../../openspec/specs/plugins/spec.md#requirement-blog-content-and-image-persistence)
and [the registry handoff](../../docs/HANDOFF-blogs-storage.md).
Implementation lives in the registry's `registry/components/plugins/blogs/server`;
consumer integration lives in `osthoepathie-seebach/src/intranet/blogs`.
Source adoption and deployment are separate; production migration is not implied.
