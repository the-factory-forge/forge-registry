## Why

Issue #7 requests crop confirmation when image upload dimensions are known, and
WebP preparation before sending bytes to an API.

## What Changes

- Ship `@forge/image-crop` with a fixed output ratio, drag/keyboard adjustment,
  explicit confirmation, cancellation and local WebP export.
- Add optional host-supplied thumbnail/banner dimensions to the Blog editor.
- Add showroom examples, regression checks, documentation and generated output.

## Capabilities

### New Capabilities

- `image-crop`: Confirm and prepare image uploads at known dimensions.

### Modified Capabilities

None. Existing upload and storage contracts remain compatible.

## Impact

This registry owns the change. The new item, Blogs and transitive Blogs Storage
installations receive the UI dependency. Hosts choose dimensions; the registry
has no default crop size. No customer installation, storage migration or deployment
is included. The recorded Blogs consumers, L'Aspic and Osthoepathie Seebach, need
separate reviewed adoption. The template has no recorded Blogs installation.
Unknown installations remain uninspected.
