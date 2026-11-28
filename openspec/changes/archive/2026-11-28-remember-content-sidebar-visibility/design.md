## Decisions

Store explicit open and closed choices with the existing view-preference utility. Use a stable key per view across records and languages. The server renders the plugin default and storage failures leave an in-memory toggle.

The layout exposes its state to a caller-rendered header. Blogs uses the same preference hook directly because its History control and close action live in different parts of the editor. The showroom restores saved History on entry and honors explicit URL state and subsequent Back/Forward navigation.

Keep the existing layout source target and add its preference dependency to the registry manifest.
