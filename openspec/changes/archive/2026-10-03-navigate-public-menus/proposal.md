## Why

Guests need a way to jump between menu sections. Restaurants use different
category names, so navigation must follow the categories already supplied by
each website.

## What changes

- Add sticky category tabs that scroll to sections and highlight the current section.
- Keep all matching dishes on the page and omit empty categories from navigation.
- Support narrow screens, keyboard navigation, translated names and host header offsets.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `plugins`: public Menus category navigation.

## Impact

The owning OpenSpec root is forge-spec. Source, showroom, documentation,
manifest descriptions and generated Menus endpoints change in forge-registry.
No new dependencies, service operations or required props are needed. Consumers
adopt the source through reviewed shadcn updates after publication; deployment
and production consumer updates are outside this request.
