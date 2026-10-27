## MODIFIED Requirements

### Requirement: Agent key selection and bulk deletion

Auth agent-key tables SHALL support row selection, mixed-state select-all and a
persistent bulk delete action, disabled with neutral pagination colors when no
rows are selected. Confirmation SHALL identify selected keys and
reuse the existing per-key callback. Failed keys SHALL remain selected for retry
without repeating successes. Loading, errors and pending operations SHALL disable
selection and deletion. Labels SHALL be host-overridable; authorization remains
host-owned.

#### Scenario: Select some or all keys

- **WHEN** a user selects one of several key rows
- **THEN** the header checkbox shows its mixed state and the bulk delete action becomes enabled
- **WHEN** the user activates select-all and then activates it again
- **THEN** all supplied rows are selected and then none are selected
- **AND** keyboard activation exposes the same states without moving table rows
- **AND** removed or unavailable metadata no longer contributes to selection

#### Scenario: Cancel or confirm bulk deletion

- **WHEN** a user opens bulk deletion
- **THEN** the confirmation names only the selected keys
- **AND** cancel leaves keys and selection unchanged without calling the host
- **WHEN** the user confirms
- **THEN** each selected key is passed once to the existing deletion callback
- **AND** selection controls and duplicate deletion remain disabled until completion

#### Scenario: Retry partial deletion failure

- **WHEN** one selected key fails to delete and another succeeds
- **THEN** remaining deletions are still attempted and the error identifies retryable keys
- **AND** successful keys leave the selection and confirmation
- **WHEN** the user retries
- **THEN** only the failed keys are submitted again

### Requirement: Plugin table selection and bulk deletion

Deletable plugin record tables SHALL provide row checkboxes, mixed-state select-all
and a confirmed bulk delete action for eligible rows on the current filtered page.
Selection SHALL clear on scope changes. Existing host callbacks, authorization,
preview checks and deletion restrictions SHALL remain authoritative. Failed rows
SHALL remain available for explicit retry without resubmitting successes.

#### Scenario: Select rows in a plugin table

- **WHEN** a user selects some, all or none of the eligible rows
- **THEN** the header checkbox exposes mixed, checked or unchecked state
- **AND** a translated, tooltip-backed delete action stays visible and is disabled with neutral pagination colors for an empty selection
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
