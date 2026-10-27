# Registry showroom

## Purpose

Define discovery and preview behavior in the independent registry showroom.
Read `docs/showroom.md` for its layout and development procedures.

## Requirements

### Requirement: Discoverable showroom examples

New UI items/modules SHALL have working demos using `ShowroomPreview` for sizing,
controls and navigation. The shared `examples` catalog in `src/showroom/examples.ts` SHALL
list composed components, page sections, layouts and plugins, excluding basic
controls and feedback helpers. Their demos and non-visual helpers SHALL be linked
from item guides or parent examples. The shared header owns persisted Light/Dark
selection; font and System controls are excluded.

#### Scenario: Reviewing a new module

- **WHEN** a reviewer opens the showroom homepage
- **THEN** the example appears under All and its category, and its link opens the demo
- **AND** representative interactions and relevant loading, empty and error states work
- **AND** light/dark, narrow layouts and keyboard interaction remain usable

#### Scenario: Reviewing a basic control

- **WHEN** a reviewer browses All or Component on the showroom homepage
- **THEN** basic controls and feedback helpers, including native selects, icon tooltips and action toasts, do not appear as standalone cards
- **AND** their existing demo URLs and registry installation remain available

### Requirement: Barebones mailing examples

Mailing previews SHALL demonstrate common verification, password reset, invitation,
email change and reservation confirmation messages with neutral sample content
and the existing renderer defaults. They SHALL NOT add brand presets or selectors.
Customer branding SHALL remain host-owned. Samples SHALL use synthetic data and
SHALL NOT issue tokens or deliver mail.

#### Scenario: Opening and navigating a sample

- **WHEN** a reviewer opens `/mailing` or a documented sample link
- **THEN** the default verification or selected sample renders in a sandboxed iframe
- **AND** navigation identifies the selected sample and provides direct links to every example
- **AND** account samples distinguish their purpose in the heading, copy and action, and reservation confirmation includes its reservation details
- **AND** unknown sample paths return not found
- **AND** the existing verification, password reset and reservation confirmation URLs remain available

#### Scenario: Inspecting plain text

- **WHEN** a reviewer selects the plain-text version
- **THEN** `format=text` records the choice in the URL and the same message and destination appear as text
- **AND** example navigation, reload and Back/Forward preserve that choice
- **AND** missing or invalid format values use HTML

### Requirement: Global registry search

The shared header SHALL expose a search dialog on every showroom page through a
search button, Command+K on macOS and Ctrl+K on Windows/Linux. The dialog SHALL
reuse the homepage catalog. Its transient query SHALL NOT change the underlying
page's URL or form values and SHALL clear when dismissed.

#### Scenario: Matching and displaying search results

- **WHEN** a reviewer enters a search query
- **THEN** the dialog SHALL match all query words case-insensitively against titles, descriptions, categories, tags and keywords
- **AND** results SHALL retain ordinary link behavior and show their title, category and description

#### Scenario: Displaying the search dialog

- **WHEN** a reviewer opens search at any supported screen width
- **THEN** the dialog SHALL use the current theme, fit narrow screens and trap focus
- **AND** results SHALL scroll within a stable frame

#### Scenario: Finding a demo with the keyboard

- **WHEN** a reviewer opens search with either keyboard shortcut
- **THEN** the search input receives focus and an empty-state prompt explains the scope
- **AND** typing updates the result count and matching links, or displays a no-results state
- **AND** arrow keys move between the input and results, Enter opens a result, and Escape closes search and restores focus

#### Scenario: Opening search from a demo

- **WHEN** a reviewer opens and closes search while editing or filtering a demo
- **THEN** the demo's URL, filters and unsaved inputs remain intact
- **AND** choosing a result navigates to its demo and closes search
- **AND** browser Back/Forward retains normal navigation behavior

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

#### Scenario: Centering previews beside desktop settings

- **WHEN** the content container has room for a standard or narrow preview centered beside the expanded or collapsed settings column
- **THEN** the preview SHALL center in the whole content container
- **AND** tighter containers SHALL constrain it before the settings column without overlap or horizontal overflow
- **AND** full application previews SHALL keep filling the remaining column

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

### Requirement: Unified loading feedback

The showroom SHALL show one shared loading indicator below the navbar for plugin data loading and route navigation. It SHALL appear immediately, remain visible until all activity ends, and hide 300ms later. New activity SHALL cancel a pending hide. The indicator SHALL preserve layout and focus, allow pointer interaction, expose a translated accessible name and respect reduced motion.

#### Scenario: Refreshing and navigating

- **WHEN** a reviewer refreshes data or navigates while another request is active
- **THEN** one indicator remains visible until all current loading completes
- **AND** a fast request still leaves visible feedback for 300ms after completion
- **AND** failures retain their existing messages, and unmounted sources release activity

### Requirement: Device preview sizes

The showroom navbar SHALL offer one accessible icon button that cycles Small
(390px) → Medium (768px) → Big (100% available width), defaulting to Big. The
control SHALL change `--showroom-device-width`, used as the main showroom
content's maximum width, without changing the URL or browser history.

#### Scenario: Identifying the device control

- **WHEN** the device control is displayed
- **THEN** its icon, accessible name and tooltip SHALL identify the current size and next action
- **AND** the button SHALL sit to the right of the theme control and use filled active styling only for Small and Medium

#### Scenario: Constraining preview content

- **WHEN** a reviewer selects a preview size
- **THEN** demos SHALL render directly in the main document without a device-preview iframe
- **AND** the navbar SHALL retain its normal width and the settings layout SHALL adapt to the content container
- **AND** component media queries and portaled dialogs SHALL retain the actual browser viewport

#### Scenario: Resizing without navigation

- **WHEN** a reviewer clicks the device control or activates it with Enter or Space
- **THEN** the maximum content width cycles through 390px, 768px and 100%
- **AND** the same control retains focus and updates its icon, accessible name and tooltip
- **AND** no document loads, route changes or browser-history entries are added
- **AND** there is one showroom navbar and no nested preview document

#### Scenario: Navigation and reload

- **WHEN** a reviewer navigates within the showroom
- **THEN** the current width remains active and ordinary Back/Forward navigation works
- **WHEN** the document reloads
- **THEN** the width returns to Big

#### Scenario: Viewing on a smartphone

- **WHEN** the browser is narrower than 640px
- **THEN** the device control is hidden and content is capped by the available width

#### Scenario: Preserving state while resizing

- **WHEN** a reviewer switches between Small, Medium and Big
- **THEN** the existing page resizes without reloading or remounting
- **AND** sample-data edits, unsaved inputs and preview settings remain intact
- **AND** resizing the browser preserves open dialogs and their normal modal behavior
