# Design

## Menus reuse categories

A menu orders categories. A category owns its dishes, even when several menus use it. An edit to a shared category affects every menu that uses it, so staff see those menus before editing. Detaching leaves the category and its dishes intact. Deleting a category keeps its dishes by default, so reorganizing menus does not destroy reusable content. Staff can reassign them from the bottom of the workspace. An explicit delete-all option still checks the existing file protections. Shared and weekly categories remain protected.

The workspace keeps actions next to the current menu's heading and keeps edits attached to their original record. Menu and dish moves use version checks and save atomically. Category deletion verifies the complete dish/version snapshot before changing anything. Older callers without deletion options remain empty-only. Hosts choose how to link to each menu and load later sections.

## Three menu types, one set of dishes

Standard and set menus use the same categories and dishes. A set menu can state a shared price in its description. The currency label applies to the whole menu and does not convert amounts. Weekly menus group dishes by day and course. Starting next week copies the structure and selected days into an independent, unpublished menu so last week’s dishes cannot accidentally go live.

## One saved menu, two previews

Web uses the visitor layout with saved content, including when the menu is unpublished. Paper uses the same menu, keeps the print settings and omits dish photos. The weekly layout uses a grid on wide screens and in print, and stacks days on phones. Printing starts from Paper. Preview changes neither publication nor the saved content.

Anonymous menu and photo reads use the same publication, date and dish-visibility rules. Unassigned dishes remain private and are absent from paper output. The host supplies the date and serves authorized staff image URLs for private previews. A missing price differs from zero; a set price goes in the menu or category description.

## Photos use private Drive scopes

Save the dish, then upload and associate its optional cropped photo. A failed upload can retry against the saved dish without duplicating it or replacing the current photo. Supplementary files remain private. Public reads check the exact selected image, and the selected image is protected from deletion.

The [shared storage contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/host-integration/spec.md#requirement-site-and-plugin-scoped-object-storage) puts Drive-managed media under `<SITE_NAME>/drive/`. Terminal60 has its own adapter and separate dish-media prefix. Adopting Registry menus must preserve that adapter and existing image keys. Standardizing the physical prefix would require a separate change to the shared contract.

## Adoption is explicit

Existing flat integrations keep their APIs. Hosts that adopt menus apply a forward migration, allowing a dish to have no category, and connect the new public menu and image reads together. Applied migrations and stored dish identities stay intact. Installation does not move objects or seed customer data. Public copy uses **Menu**; existing technical identifiers in this draft remain unchanged.

See the [requirements](specs/menu-cards/spec.md), [photo workflow](specs/plugins/spec.md) and [tasks](tasks.md) for acceptance checks and distribution.
