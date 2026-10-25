## Purpose

Provide a reusable page arrangement for primary content and supporting controls or information, keeping desktop panel actions accessible while preserving a simple mobile reading order.

## ADDED Requirements

### Requirement: Content and supporting panel layout

The registry SHALL distribute a framework-neutral layout with primary content, optional toolbar and optional supporting panel. Callers SHALL own labels, semantics, content and visibility state. The layout SHALL preserve primary content state when a panel appears or disappears.

#### Scenario: Desktop supporting panel

- **WHEN** a caller supplies a panel at desktop widths
- **THEN** the primary content occupies the flexible left column and the panel occupies the right column
- **AND** the toolbar remains above the panel with visible spacing

#### Scenario: No supporting panel

- **WHEN** the caller omits or closes the panel
- **THEN** the content uses the available width and any supplied toolbar stays above it
- **AND** existing field values and content state are preserved

### Requirement: Accessible panel scrolling

Desktop panel controls SHALL stick below the host header offset with viewport clearance. Long panel content SHALL scroll independently without hiding the toolbar. Narrow layouts SHALL place the toolbar and panel above the content in normal page flow.

#### Scenario: Long desktop panel

- **WHEN** the page or a long supporting panel scrolls
- **THEN** the toolbar remains visible below the header and the panel's final controls remain reachable
- **AND** a host without a header offset receives viewport clearance without a showroom dependency

#### Scenario: Narrow screen

- **WHEN** the viewport is below the desktop breakpoint
- **THEN** toolbar, supporting panel and primary content stack in that order
- **AND** the panel expands in page flow without clipping or a desktop-only inner scrollbar

### Requirement: Source installation and discovery

The layout SHALL install through its own registry item with complete dependencies and have a working showroom example in the Layout category. Plugins using it SHALL declare its registry dependency.

#### Scenario: Installing Blogs

- **WHEN** a consumer installs the updated Blogs item
- **THEN** the layout and its dependencies are installed at their declared targets
- **AND** Blogs retains its existing history controls, permissions and mobile close/focus behavior
