## ADDED Requirements

### Requirement: Plugin table selection and bulk deletion

Deletable plugin record tables SHALL provide row checkboxes, mixed-state select-all
and a confirmed bulk delete action for eligible rows on the current filtered page.
Selection SHALL clear on scope changes. Existing host callbacks, authorization,
preview checks and deletion restrictions SHALL remain authoritative. Failed rows
SHALL remain available for explicit retry without resubmitting successes.

#### Scenario: Select rows in a plugin table

- **WHEN** a user selects some, all or none of the eligible rows
- **THEN** the header checkbox exposes mixed, checked or unchecked state
- **AND** a translated, tooltip-backed delete action appears only for a nonempty selection
- **AND** keyboard use and desktop/mobile layouts work in light and dark themes

#### Scenario: Confirm a batch and recover from rejection

- **WHEN** deletion is confirmed in Customers, Projects, Employees, Blogs or Menus
- **THEN** existing callbacks run once per selected record and pending controls prevent duplicates
- **AND** rows disappear optimistically and reappear on rejection
- **AND** confirmation retains only failed names and stable Blog request IDs for retry
- **AND** employee self-deletion and Menu linked-file restrictions still apply

#### Scenario: Delete Drive entries

- **WHEN** selected file or trash entries are submitted for deletion
- **THEN** server previews and tokens are obtained for every entry before confirmation
- **AND** failed preparation blocks deletion and offers retry
- **AND** partial failure refreshes previews before another explicit confirmation
- **AND** trash, permanent deletion and Undo retain their existing behavior

#### Scenario: Move between result scopes

- **WHEN** the filter, page, folder or resource changes
- **THEN** the new scope starts without selected rows and unavailable rows are pruned
- **AND** a previously confirmed batch may finish across an automatic host page reset
- **AND** unmounting the control stops later calls while server authorization guards each operation
- **AND** tables without a row deletion operation do not gain a bulk action
