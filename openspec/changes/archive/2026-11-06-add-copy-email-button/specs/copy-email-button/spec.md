## ADDED Requirements

### Requirement: Accessible email copying

CopyEmailButton SHALL copy the exact supplied email only after user activation, expose a translated accessible label and tooltip, preserve keyboard focus, and keep its icon reachable on narrow layouts.

#### Scenario: Successful activation

- **WHEN** a visitor clicks the button or activates it by keyboard
- **THEN** the supplied address is written to the clipboard without submitting a surrounding form
- **AND** a success message appears only after the write resolves

#### Scenario: Clipboard failure

- **WHEN** clipboard access is unavailable or rejects the write
- **THEN** an error message advises manual copying without reporting success
- **AND** the control remains usable for a later retry

#### Scenario: No address

- **WHEN** the supplied email is empty
- **THEN** the copy button is disabled
