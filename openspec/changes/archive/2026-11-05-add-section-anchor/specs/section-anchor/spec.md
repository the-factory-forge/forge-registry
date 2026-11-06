## ADDED Requirements

### Requirement: Shareable section titles

SectionAnchor SHALL render a keyboard-accessible native fragment link with a stable caller-supplied target ID, preserving the path and query and exposing visible focus. It SHALL support a sticky-header scroll offset without a router dependency.

#### Scenario: Activate a section title

- **WHEN** a visitor clicks a title or presses Enter on its focused link
- **THEN** the URL fragment identifies that section and its title scrolls into view
- **AND** the page does not reload or discard unsaved form values

#### Scenario: Reload or open a shared section URL

- **WHEN** a matching title mounts on a page with a fragment, including after asynchronous data loads
- **THEN** the title scrolls into view below the configured offset without animation

#### Scenario: Invalid or unavailable target

- **WHEN** a fragment is malformed or has no rendered matching title
- **THEN** the component does not throw or load hidden content
