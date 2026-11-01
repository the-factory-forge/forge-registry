## RENAMED Requirements

- FROM: `### Requirement: Modal form submission shortcut`
- TO: `### Requirement: Form submission shortcut`

## MODIFIED Requirements

### Requirement: Form submission shortcut

Plugin forms, including standalone editors, account forms and the Agents composer,
SHALL submit through their existing primary form button on Cmd+Enter on macOS or
Ctrl+Enter on Windows/Linux. The shortcut SHALL preserve native validation,
disabled states, pending guards and failure recovery. It SHALL apply only to
keyboard events inside the form or its active dialog, ignore repeated or composing
key events and leave ordinary Enter behavior intact. It SHALL NOT activate
unrelated actions or skip a confirmation step.

#### Scenario: Submit a form with the keyboard

- **WHEN** a user presses Cmd+Enter or Ctrl+Enter inside an enabled form
- **THEN** the same form action runs as clicking its submit button
- **AND** invalid fields block submission and failed saves retain entered values

#### Scenario: Send an Agents message

- **WHEN** an operation is selected and the composer can send a message
- **THEN** Cmd+Enter or Ctrl+Enter sends the current draft once
- **AND** ordinary Enter inserts a newline
- **AND** the shortcut does not approve a proposed agent action

#### Scenario: Disabled or unrelated actions

- **WHEN** the submit button is disabled, the key repeats or text composition is active
- **THEN** the shortcut performs no mutation
- **AND** events in a nested portal do not submit an enclosing form or dialog
