# Content sidebar layout

When a plugin uses this layout, open the sidebar by default if it contains
actions needed to complete the workflow, such as issuing an offer. Close it
by default for supplementary information, such as blog revision history.
Record the choice and its reason in the plugin’s own `AGENTS.md`.

Pass `defaultOpen` and a stable `preferenceKey` built from the plugin, view and
panel names. Wire the translated toggle to the open state and setter from
`renderHeader`. If the trigger belongs inside an editor or a host controls the
view, use `useContentSidebarPreference` with the same key and default. Apply
permission checks before supplying the panel or its toggle.

Verify a first visit and re-entry after choosing each state. An explicit URL
state takes precedence on that visit. See the [layout guide](../../../../docs/content-sidebar-layout.md)
for the component API.
