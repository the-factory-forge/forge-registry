# Design

The public page derives options through `getMenuFilterLabels` from the original
supplied sections. Keep its existing preset ordering, translated labels, host IDs
and custom-label handling, but omit choices not assigned to a visible item.
Continue using original sections rather than filtered results so selected choices
remain available for clearing and combined filters.

The complete `menuLabelPresets` export and staff taxonomy are unchanged. Item
editors continue receiving all host labels. A newly assigned label appears in
public filters once a visible item is saved; removing its final assignment or
hiding every assigned item removes that public choice. Overrides can order
assigned options but cannot add unused filters. Keep existing prop and helper
signatures and avoid schema or persistence changes.

Validate hidden-item exclusion, custom/host IDs and unused overrides in the
existing unit test. Extend the public browser journey to confirm the full staff
catalog remains available and saved assignments add/remove public choices.
Regenerate the registry and verify an official consumer installation.
