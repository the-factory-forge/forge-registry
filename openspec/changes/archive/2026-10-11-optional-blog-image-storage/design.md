## Context

ADR-0009 keeps Markdown in PostgreSQL and uploaded images in S3. The current
registry at 83520ced54bc058f08d923d0cca4f7d840a94a5e already implements this split.
Its required constructor bucket prevents unconfigured local operation. L'Aspic's
modified d5cc3286 checkout contains a local optional-storage adaptation.

## Decisions

Relax only the S3 client and bucket options; retain the required scoped prefix.
Check configuration after upload authorization and before reserving an object.
Use a distinct error code through the existing translation and toast pipeline.
The shared toast already renders errors; L'Aspic's older renderer receives only
an error icon branch, preserving its layout and existing success behavior.
Existing configured clients remain compatible. Preserve generic provider/database
errors and all image validation, authorization and publication checks.

The manifest owns `blogs` UI/errors and `blogs-storage` server files, installed at
`@components/plugins/blogs`. L'Aspic relocates them under
`src/intranet/components/forge/plugins/blogs` with `#/` aliases and `.ts` extensions.
Port only the error contract there; retain its server-bundled originals, legacy S3
reader and incremental SQL history. No upstream bundled-image or legacy API is needed.

## Verification and consumers

Real PostgreSQL/MinIO tests cover configured uploads and absent bucket/client cases.
A disposable shadcn consumer verifies generated named-item installation. L'Aspic's
production-browser check verifies upload error toast, retained draft and subsequent
text publication with S3 credentials blank. The clinic needs optional configuration
in its host adapter; the template has guidance but no installed Blogs module.
