# Define Forge plugins and align their UI

## Why

The shared specs define UI and distribution rules but do not explain what each
plugin does or distinguish feature UI, server companions and host adapters.
Existing controls also have gaps in cursor, action icon, status and theme usage.

## What changes

- Add the shared Plugins definition and a requirement for every current plugin.
- Link the capability from spec/registry contributor entry points and guides.
- Apply existing Shared UI rules across registry controls and plugin views.
- Regenerate source distribution and verify showroom and consumer behavior.

## Capabilities

### New capabilities

- `plugins`: optional application features, their capabilities and host boundaries.

## Impact

forge-registry owns this change. forge-registry owns UI, integration documentation,
showroom and generated items. Existing public props and server operations remain
compatible. Existing hosts need semantic status tokens before updating source.
This change does not install into or deploy live consumer projects. The existing
unify-action-icons change continues to own the shared status-placement rule.
