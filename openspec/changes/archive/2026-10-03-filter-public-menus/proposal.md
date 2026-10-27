## Why

Public menus show allergen and dietary labels but guests cannot narrow the dishes
using them. Add filters to the shared Menus page.

## What changes

- Exclude dishes with any selected allergen and require every selected dietary label.
- Build choices from supplied public items, keep choices available after filtering,
  omit empty categories, announce results, and provide a reset action.
- Use keyboard-accessible controls, host theme tokens and optional translated labels.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `plugins`: public Menus allergen and dietary filtering.

## Impact

The owning OpenSpec root is forge-spec. Implementation, the existing showroom,
documentation and generated `@forge/menus` endpoints change in forge-registry.
No new packages, schema, service operations or required page props are needed.
Existing consumers such as Terminal60 adopt the source through a reviewed shadcn
update after publication and can translate the optional filter labels. Production
consumer updates and deployment are outside this request; a disposable consumer
installation verifies the generated source.
