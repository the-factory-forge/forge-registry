## ADDED Requirements

### Requirement: Modal form submission shortcut

Plugin create/edit modal forms SHALL submit through their existing primary form
button on Cmd+Enter on macOS or Ctrl+Enter on Windows/Linux. The shortcut SHALL
preserve native validation, disabled states, pending guards and failure recovery.
It SHALL apply only to keyboard events inside the active dialog, ignore repeated
or composing key events and leave ordinary Enter behavior intact. Destructive
confirmations and standalone page forms SHALL NOT gain this shortcut.

#### Scenario: Save a modal with the keyboard

- **WHEN** a user presses Cmd+Enter or Ctrl+Enter inside an enabled create/edit modal
- **THEN** the same form action runs as clicking its submit button
- **AND** invalid fields block submission and failed saves retain entered values

#### Scenario: Disabled or unrelated modal actions

- **WHEN** the submit button is disabled, the key repeats or text composition is active
- **THEN** the shortcut performs no mutation
- **AND** events in a nested portal do not submit an enclosing dialog's form
