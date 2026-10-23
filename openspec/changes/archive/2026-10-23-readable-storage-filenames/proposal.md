## Why

S3 objects currently discard upload filenames and extensions, making bucket contents
hard to identify. Users requested `[asset_name]-[type]-[modifier].[extension]`.

## What Changes

Use readable immutable filenames for future Drive and Blogs uploads, retaining
unique directories, scoped prefixes and legacy keys. Use upload context for type
and rebuild existing type fields. Preserve underscores within fields and supplied
variant modifiers; omit missing or `original` modifiers. Add an additive Drive metadata migration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugins`: readable object filenames and compatible adoption.

## Impact

The owning OpenSpec root is forge-registry. Implementation, tests, generated items and
integration guides live in forge-registry. Drive, Blogs and Menus storage consumers
need reviewed adoption; no customer updates, bucket migration or deployment is included.
This is shared storage behavior, independent of customer-specific content.
