## ADDED Requirements

### Requirement: Optional blog image storage

Blogs SHALL remain usable with PostgreSQL when the host has no S3 client or bucket.
Text creation, reading, editing, category management and publication without images
SHALL remain available. An authorized image upload without image storage SHALL fail
with `STORAGE_NOT_CONFIGURED` before reserving or writing an object. The editor SHALL
show the translated error through the shared action toast and preserve unsaved text.
Hosts SHALL retain server authorization and an explicit site/plugin key prefix.
Image reads, image publication and cleanup SHALL NOT issue unconfigured object requests.

#### Scenario: Editing locally without a bucket

- **WHEN** an authorized editor creates, saves and publishes an article without images and no S3 bucket is configured
- **THEN** its text and publication persist in PostgreSQL without S3 requests
- **AND** article access does not depend on object storage setup

#### Scenario: Attempting an upload without image storage

- **WHEN** an authorized editor selects an image while the S3 client or bucket is missing
- **THEN** an error toast explains that image storage is not configured
- **AND** unsaved article text remains intact and no object-ledger row is created
- **AND** unauthorized callers still receive an authorization error
