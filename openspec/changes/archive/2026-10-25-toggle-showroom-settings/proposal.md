# Toggle showroom settings

## Why

Expanded settings can occupy most of a mobile screen. Users need to hide them while inspecting a demo.

## What Changes

- Add an icon-only Settings button beside the preview-controls title to show and hide its content.
- Preserve control values, keyboard access and responsive preview sizing.
- Update the showroom guide and browser regression coverage.

## Capabilities

### Modified Capabilities

- `registry-showroom`: toggle preview settings on desktop and mobile.

## Impact

Only forge-registry showroom source, styles, documentation and tests change. No distributed registry item, public component API, dependency or consumer adapter changes.
