## Why

TC's expanding search should be reusable through Forge, with one independent control per table.

## What Changes

- Add `@forge/table-search`, its matching helper, translated label props and a discoverable showroom example.
- Use it in all registry data tables, preserving existing filtering callbacks.
- Add an optional `alwaysExpanded` prop and reuse the control on the showroom homepage.
- Reinstall the generated item into tc-website, preserving each table's local state and the animation overflow fix.

## Capabilities

### New Capabilities

- `table-search`: Portable expanding search and per-table filtering.

### Modified Capabilities

None.

## Impact

The owning root is forge-registry. Source, manifest, demos, documentation and generated distribution change here; tc-website receives a reviewed shadcn install. Existing customer, project, blog and Drive callbacks remain compatible. Employees gains optional host-controlled search for pagination. No template, database, email or printable-document changes are included.
