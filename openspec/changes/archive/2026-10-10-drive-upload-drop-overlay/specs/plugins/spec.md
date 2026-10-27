## ADDED Requirements

### Requirement: Drive upload drop feedback

An upload-enabled Drive browser SHALL highlight its existing file drop area while
files are dragged over it. The overlay SHALL show translated upload guidance,
respect the host theme and retain the table's geometry and upload validation.
Non-file drags and unavailable upload actions SHALL NOT show an upload target.

#### Scenario: Dragging files over the table

- **WHEN** files enter an available upload area
- **THEN** an overlay marks the full drop area and stays visible while crossing its child elements
- **AND** dropping files uses the existing upload queue and folder rejection behavior
- **AND** leaving, dropping, canceling the drag or losing upload availability clears the overlay
- **AND** both themes and narrow layouts retain readable guidance without shifting the table
