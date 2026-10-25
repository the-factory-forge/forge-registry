# Registry showroom

## Purpose

Define discovery and preview behavior in the independent registry showroom.
Read `docs/showroom.md` for its layout and development procedures.

## Requirements

### Requirement: Discoverable showroom examples

New UI items/modules SHALL have working demos using `ShowroomPreview` for sizing,
controls and navigation. The homepage `examples` in `src/routes/index.tsx` SHALL
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

### Requirement: Unified loading feedback

The showroom SHALL show one shared loading indicator below the navbar for plugin data loading and route navigation. It SHALL appear immediately, remain visible until all activity ends, and hide 300ms later. New activity SHALL cancel a pending hide. The indicator SHALL preserve layout and focus, allow pointer interaction, expose a translated accessible name and respect reduced motion.

#### Scenario: Refreshing and navigating

- **WHEN** a reviewer refreshes data or navigates while another request is active
- **THEN** one indicator remains visible until all current loading completes
- **AND** a fast request still leaves visible feedback for 300ms after completion
- **AND** failures retain their existing messages, and unmounted sources release activity

### Requirement: Device preview sizes

The showroom navbar SHALL offer one accessible icon button that cycles Small
(Phone) → Medium (Tablet) → Big (Laptop) → Small. Its icon SHALL show the current
size, and its accessible name and tooltip SHALL describe the current size and
next action. Big SHALL remain the default. Phone SHALL use a 390px viewport,
Tablet a 768px viewport and Laptop the normal available width. Embedded previews
SHALL apply real viewport breakpoints and omit duplicate showroom navigation.
The size button SHALL sit immediately to the right of the theme control and use
filled active styling only for Phone and Tablet, leaving Laptop unhighlighted.

#### Scenario: Selecting and restoring a preview

- **WHEN** a reviewer selects Phone or Tablet on a screen at least 640px wide
- **THEN** the preview uses that viewport and the selection is reflected in the URL
- **AND** reload and Back/Forward restore the selection, while invalid values use Laptop
- **AND** theme changes and navigation remain usable inside the preview

#### Scenario: Cycling preview sizes

- **WHEN** a reviewer activates the size button by click, Enter or Space
- **THEN** the preview advances from Small to Medium, Medium to Big, or Big to Small
- **AND** the same button retains focus and updates its icon, accessible name and tooltip

#### Scenario: Viewing on a smartphone

- **WHEN** the outer screen is narrower than 640px
- **THEN** the device control is hidden and the normal responsive page is shown
- **AND** a saved phone or tablet parameter does not constrain that page

#### Scenario: Preserving state while resizing

- **WHEN** a reviewer switches between Phone, Tablet and Laptop, including via Back/Forward
- **THEN** the same preview instance resizes without reloading or remounting its content
- **AND** sample-data changes, unsaved inputs, open dialogs, preview settings and scroll position remain intact
- **AND** resizing the outer screen across the smartphone breakpoint also retains that state
