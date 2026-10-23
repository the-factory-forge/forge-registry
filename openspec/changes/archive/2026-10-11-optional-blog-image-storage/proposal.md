## Why

The Blogs companion already stores text in PostgreSQL, but its constructor still
requires S3 configuration. This prevents local text editing without image storage.

## What changes

Make image storage optional at initialization. Reject only image operations with a
safe translated error and preserve the editor draft. Remove the originating site's
configuration banner and use its existing upload-error toast.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `plugins`: allow PostgreSQL-only Blogs operation and explain missing image storage.

## Impact

Forge Spec owns this change. Forge Registry owns `blogs` and `blogs-storage` source,
distribution, tests and integration guidance. L'Aspic adopts the focused change
while retaining its migrations, bundled images and legacy content recovery. Other
consumers remain explicit follow-ups; no production migration or deployment occurs.
