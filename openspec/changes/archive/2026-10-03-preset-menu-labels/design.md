## Context

Menu labels currently contain a stable ID, allergen/dietary kind and translations.
Public menu views contain localized names and retain those IDs. The database has
no visual metadata columns. The Menus item already declares Lucide and semantic
status theme roles. ADR-0002 and ADR-0006 preserve host data and portable styling.

## Decisions

Ship a plain TypeScript catalog with stable IDs, four translated names, an icon
key and a status tone. Cover the 14 allergen groups listed by EFSA and common
dietary menu flags. Reuse the existing success, pending and informational pairs;
warning presentation uses pending orange. Milk is blue, Gluten is orange and
Vegetarian/Vegan are green. Colors identify the labels rather than risk severity.

Resolve presentation by preset ID or a known translated name for older host IDs.
Keep matching dish labels by their actual assigned IDs. Replace a matching default
choice with its host label, preserve custom options, and never infer ingredients
or dietary claims. Defaults with no assigned dishes remain selectable. The optional
localized `filterLabels` prop replaces unused defaults without hiding assigned labels.

Reuse one exported badge in public dishes, checkbox filters and the staff item
editor. Decorative icons retain visible text; native checkboxes show selection
with a ring without changing the label's tone. Populate the showroom taxonomy
from the same catalog. Production hosts can explicitly seed labels through their
existing authorized operations, without a migration or automatic data writes.

## Verification

Test catalog completeness, stable identifiers, translations, alias presentation,
custom IDs, unused filters and the existing combined filter behavior. Browser
checks cover icon badges, semantic colors, keyboard use, reset, narrow layouts,
translated defaults and category navigation. Regenerate Menus and verify a clean
consumer install/typecheck, then run repository and OpenSpec checks.
