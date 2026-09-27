## ADDED Requirements

### Requirement: Login password Caps Lock feedback

The login password field SHALL display a Caps Lock icon when its keyboard or click events report Caps Lock enabled. It SHALL provide a translated accessible status and preserve password visibility, value, and error descriptions.

#### Scenario: Caps Lock is enabled

- **WHEN** the focused password field receives a keyboard or click event with Caps Lock enabled
- **THEN** an icon appears inside the field beside its visibility button
- **AND** the accessible description includes the localized Caps Lock status

#### Scenario: Caps Lock is disabled or focus leaves

- **WHEN** an event reports Caps Lock disabled or the password field loses focus
- **THEN** the indicator and its accessible description are cleared

#### Scenario: Shift produces uppercase text

- **WHEN** Shift is held without Caps Lock
- **THEN** no Caps Lock indicator appears

#### Scenario: The password is revealed

- **WHEN** the user reveals the password and types with Caps Lock enabled
- **THEN** the same indicator appears without changing the password value
