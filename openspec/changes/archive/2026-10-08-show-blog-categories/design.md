## Design

Add optional `BlogListItem.categoryNames`. The existing `articleListItem` helper
accepts categories and resolves assigned names in the requested locale, with an
available-translation fallback. Update both showroom callers and the storage
list method. Existing two-argument callers and list items remain valid.

Reuse the Categories label and table styles. Apply CSS ellipsis to titles and
category lists, keep their complete text in the DOM, and expose it on hover.
Contain positioned hidden status text inside the horizontal scroll area so the
extra column cannot create page overflow. Preserve sticky edit/delete actions.

Check localized names, unassigned posts, long content, narrow layouts, themes
and existing deletion behavior. Rebuild source distribution and validate an
independent consumer. Live host updates remain outside this task.
