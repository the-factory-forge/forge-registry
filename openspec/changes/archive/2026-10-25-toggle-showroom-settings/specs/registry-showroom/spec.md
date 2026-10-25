## ADDED Requirements

### Requirement: Toggleable preview settings

Demos with controls or navigation SHALL provide a Settings gear beside the panel title, with an accessible name, tooltip and visible expanded state. Settings SHALL start hidden below 40rem and open otherwise. Toggling SHALL retain control values and remain available when collapsed. Hidden controls SHALL leave layout and keyboard navigation. Demos without settings SHALL omit the toggle.

#### Scenario: Hiding and reopening settings

- **WHEN** a reviewer activates Settings by pointer or keyboard
- **THEN** the panel visibility and button state toggle together
- **AND** reopening preserves selected preview options and demo content
- **AND** the behavior works at narrow and desktop widths in both themes

#### Scenario: Preview layout while settings are hidden

- **WHEN** the reviewer hides the settings panel
- **THEN** the preview uses the available width within its existing width limit
- **AND** only the gear button and its padding remain in the collapsed panel, without a separate toolbar row or covering preview content

#### Scenario: Collapsed settings on a smartphone

- **WHEN** the reviewer hides settings below 40rem
- **THEN** the gear shares a standard or narrow preview’s first row, including the blog editor’s Back to posts row
- **AND** the separate empty settings row disappears while preview controls remain usable without overlap
- **AND** full application previews retain their full width below the gear, and tablet and desktop placement remain unchanged

#### Scenario: Responsive initial visibility

- **WHEN** a reviewer opens or reloads a demo on a smartphone below 40rem
- **THEN** settings are collapsed and the gear remains available to open them
- **AND** opening or reloading the demo at 40rem or wider starts with settings expanded
- **AND** changing the viewport after toggling preserves the chosen visibility
