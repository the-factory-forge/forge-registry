## ADDED Requirements

### Requirement: Agent key selection and bulk deletion

Auth agent-key tables SHALL support row selection, mixed-state select-all and a
conditional bulk delete action. Confirmation SHALL identify selected keys and
reuse the existing per-key callback. Failed keys SHALL remain selected for retry
without repeating successes. Loading, errors and pending operations SHALL disable
selection and deletion. Labels SHALL be host-overridable; authorization remains
host-owned.

#### Scenario: Select some or all keys

- **WHEN** a user selects one of several key rows
- **THEN** the header checkbox shows its mixed state and the bulk delete action appears
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
