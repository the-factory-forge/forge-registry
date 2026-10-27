# Design

Follow ADR-0007's host-owned configuration and migration boundaries and
[ADR-0009](../../../../concepts/adr/0009-blog-content-and-image-storage.md).

Remove S3 Markdown hydration/reservations from the existing companion. Store full
article documents in the existing JSONB column; retain version checks and retry
transactions. Generate revision IDs for editorial state without creating objects.
Keep image upload, verification, authorization and cleanup behavior.

Template changes are guidance only: Blogs remains optional. The clinic installs
reviewed server/type/utility source via shadcn while preserving its UI and
transport. Add `blogs_*` through an incremental migration; a separate verified
image transfer preserves legacy `blog_*` data and completes before app cutover.
No fallback or migration for unused S3 Markdown is implemented.

Verify generated distribution, a clean consumer install, registry storage tests,
clinic transfer failure/retry checks and browser journeys. Record deployment as
unverified until an operator performs the documented production steps.
