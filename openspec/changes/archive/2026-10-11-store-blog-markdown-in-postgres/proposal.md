# Store blog Markdown in PostgreSQL

## Why

The owner wants the shared Blogs companion to store image bytes in S3 while keeping
Markdown with transactional article metadata in PostgreSQL. The former S3 Markdown
flow had no website users, so no legacy migration is needed.

## What Changes

- Simplify `@forge/blogs-storage` to store text in PostgreSQL and upload images only.
- Preserve authorization, validation, retries and multilingual publication behavior.
- Update template installation guidance and adopt the companion in the clinic,
  preserving existing database content and migrating image bytes explicitly.
- Provide a registry HANDOFF for other consumers and record pending adoption.

## Impact

Originally owned by forge-spec; this archive now belongs to forge-registry with
the [Plugins spec](../../../specs/plugins/spec.md). Its completed tasks and
verification retain the original repository labels and evidence.
Implementation: forge-registry, forge-template and osthoepathie-seebach.
The reusable storage policy belongs in the registry; clinic schema, content and
migration commands remain host-owned. No other website update or deployment is implied.
