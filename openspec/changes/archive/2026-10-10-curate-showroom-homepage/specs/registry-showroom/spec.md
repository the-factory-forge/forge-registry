## MODIFIED Requirements

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
