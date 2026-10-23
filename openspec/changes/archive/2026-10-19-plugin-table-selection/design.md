# Design

Use one distributed table-selection helper, installed transitively by affected
plugins. Native checkboxes expose the mixed state; an icon-only header action
reserves its footprint and opens an accessible confirmation listing selected names.

Selection is ephemeral action state. ADR-0008 remains unchanged: existing host
filters and pagination retain their controlled/URL boundaries. The helper clears
selection by scope and prunes removed rows. A confirmed batch snapshots its records
and request IDs, runs sequentially with the existing optimistic mutation utility,
and retains failures for explicit retry. Automatic host page resets cannot discard
an already confirmed batch. Unmounting stops subsequent calls.

Drive supplies a preparation callback to fetch each existing deletion preview and
token. Confirmation waits for all previews; retries refresh previews after partial
failure. Existing callbacks still own trash, purge, Undo and authorization. Employee
self-deletion, Blog idempotency and Menu file restrictions remain intact.

The new helper is demonstrated in parent tables; it has no homepage card. The
manifest ships its client code and pure label defaults, with declared dependencies.
Existing Auth selection remains compatible and unchanged by this follow-up.
