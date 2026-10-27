## ADDED Requirements

### Requirement: Blog content and image persistence

`@forge/blogs-storage` SHALL store complete draft and published Markdown with
metadata in PostgreSQL and use private S3 only for uploaded image bytes. Draft
saves SHALL update content, version and retry result in one database transaction.
Text-only reads, saves and publication SHALL NOT issue S3 requests. Publication
with images SHALL verify that the image objects exist.

#### Scenario: Saving while object storage is unavailable

- **WHEN** an authorized editor saves or publishes an article without images while S3 is unavailable
- **THEN** Markdown and metadata persist together in PostgreSQL
- **AND** a database failure leaves the previous draft and publication intact
- **AND** the operation creates no Markdown object or object-ledger entry

### Requirement: Blog image lifecycle and transfer

Image cleanup SHALL preserve referenced draft/publication images. Article deletion
SHALL remove public visibility immediately and leave image cleanup retryable after
the grace period. Hosts transferring database image bytes to S3 SHALL preserve
article documents and image IDs, verify uploaded bytes before cutover and retain
the original data until recovery is verified.

#### Scenario: Transferring database images

- **WHEN** a host adopts the companion from a custom database image adapter
- **THEN** the transfer preserves drafts, publications, translations, image IDs and public URLs
- **AND** failed image verification prevents committing the data transfer
- **AND** retries do not overwrite different bytes or resurrect subsequently deleted articles
