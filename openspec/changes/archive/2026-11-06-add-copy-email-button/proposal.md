## Why

Profile headers need a quick, accessible action to copy a displayed email address. TC already implements this behavior and requests upstream promotion.

## What Changes

Add `@forge/copy-email-button`, using the existing tooltip and action-toast components, plus a linked showroom demo, distribution and browser checks.

## Capabilities

### New Capabilities

- `copy-email-button`: exact email copying with success and failure feedback.

### Modified Capabilities

None.

## Impact

Registry owns `openspec/specs/copy-email-button/spec.md`, source, manifest, generated JSON, documentation, demo and tests. Forge Specs receives a consumer inventory note. TC retains its equivalent Button/Sonner implementation without a source reinstall. No existing plugin or template depends on the new item.
