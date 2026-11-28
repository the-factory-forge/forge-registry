## MODIFIED Requirements

### Requirement: Content and supporting panel layout

The registry SHALL distribute a framework-neutral layout with primary content, optional toolbar and optional supporting panel. Callers SHALL own labels, semantics and content, and MAY supply visibility state. The layout SHALL preserve primary content state when a panel appears or disappears.

#### Scenario: Desktop supporting panel

- **WHEN** a caller supplies a panel at desktop widths
- **THEN** the primary content occupies the flexible left column and the panel occupies the right column
- **AND** the toolbar remains above the panel with visible spacing

#### Scenario: No supporting panel

- **WHEN** the caller omits or closes the panel
- **THEN** the content uses the available width and any supplied toolbar stays above it
- **AND** existing field values and content state are preserved

## ADDED Requirements

### Requirement: Sidebar visibility preference

The layout SHALL accept a default visibility and a view-scoped preference key.
Core actions SHALL default open and supplementary information SHALL default closed.

#### Scenario: Returning to a plugin view

- **WHEN** the user explicitly opens or closes the panel and revisits the view
- **THEN** the saved choice takes precedence over the configured default for that view
- **AND** other views keep their own preferences

#### Scenario: Missing or unavailable storage

- **WHEN** the browser has no valid preference or denies access to storage
- **THEN** the panel starts at the configured default and can be toggled during the visit
