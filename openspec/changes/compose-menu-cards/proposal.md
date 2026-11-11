# Proposal

## Why

Restaurants need separate food and drinks cards without maintaining duplicate shared sections. The current Menus plugin has one category/item list, creates every dish hidden and places photo selection in a full Drive browser after creation.

Terminal60 validated this workflow in its intranet. Registry adopts the reusable contracts and keeps site content and scheduling rules in the host.

## What Changes

- Add cards as thin compositions of ordered, reusable categories, with optional translated descriptions and explicit publication.
- Group the staff editor by cards and collapsible categories, with a sticky current-card heading and actions beside it. Hosts own sidebar navigation and progressive data loading. Reorder sections and dishes with pointer, touch and keyboard controls; support explicit Move actions and creation within a section.
- Identify shared sections, list participating cards and edit their content through one clearly labeled common-category context. Detaching a section never deletes its data.
- Include an optional main-photo field and preview in dish creation/editing, reusing the existing cropper and private Drive storage with recoverable upload failures. Keep supplementary files private.
- Add card display modes `lines` and `photos` selected by staff, preserving filters, stable text/photo/price alignment and equal base row spacing with or without an image. Reuse the guest-facing renderer for private saved-content previews and print one selected card without photos.
- Keep one publication toggle per card, one common label catalogue with per-dish selections, and a four-stop spice control using the existing levels.
- Allow dishes without an individual price. Use existing card/category descriptions for set-menu prices and inclusions, without a separate formula or ordering model.
- Preserve legacy flat integrations while hosts explicitly adopt the additive card schema and adapters. Installing source must not seed or migrate customer data.

## Capabilities

### New Capabilities

- `menu-cards`: Card composition, category sharing, ordered editing, publication and presentation.

### Modified Capabilities

- `plugins`: Permit explicit dish visibility at creation and the optional in-form main-photo workflow while preserving Menus/Drive authorization and image protections.

## Impact

Owner and main-spec destination: `forge-registry/openspec/specs/menu-cards/spec.md` and the existing `plugins/spec.md`. Shared host/storage/UI contracts remain unchanged. This change implements reusable behavior against current registry source, using Terminal60's accepted mockup as interaction evidence, not as source to copy wholesale.

Affected items are `@forge/menus`, `@forge/menus-storage`, their file/dependency closure, module definition, labels, showroom and any Menus connector contract that actually calls changed methods. `@forge/drive` keeps its general folder browser and storage transport. No Gallery plugin or connector is installed.

Terminal60 is the recorded Menus consumer. Its local integration and weekly workflow are owned by change `deliver-reviewed-terminal60-improvements` under `openspec/changes/` in the [Terminal60 repository](https://github.com/the-factory-forge/terminal60). Review reverse dependencies and the consumer inventory before source promotion; other websites receive follow-up records, not automatic updates. Weekly calendars, client PDFs/prices, imports, CHF, brand styling and Infomaniak behavior remain host-owned.

The common use case is publishing several restaurant cards with shared sections and choosing a dish's main photo. Keep the implementation to that baseline. No arbitrary nesting engine, draft snapshots, automatic expiry deletion, gallery administration or brand presets are included. Publication dates are host inputs to the public projection; the host owns its clock and time zone.
