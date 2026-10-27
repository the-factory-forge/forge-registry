## ADDED Requirements

### Requirement: Account plugin sections

Auth SHALL support additional host-supplied account tabs separate from About and
Security, with controlled navigation for URL adapters. Hosts SHALL supply only
authorized sections. Plugin fields SHALL NOT be appended automatically to About.
Existing custom-content and default account integrations SHALL remain supported.
About and plugin tabs SHALL preserve unsaved form state while switching sections.

#### Scenario: Employee and customer account

- **WHEN** the host supplies Employee and Customer sections for one account
- **THEN** each appears as a separate tab with its own content
- **AND** controlled navigation can restore the selected tab without exposing form values in the URL

### Requirement: Confirmed account email change

Auth SHALL offer an optional email-change form through a host callback. Hosts SHALL
authorize the current administrator and use provider confirmation before replacing
the current address. Failed requests SHALL retain input and allow retry; successful
requests SHALL show confirmation instructions without claiming the address changed.

#### Scenario: Requesting a new login email

- **WHEN** an authorized administrator requests a different email
- **THEN** the host sends its confirmation flow and the current email remains active until confirmed
- **AND** missing authorization or delivery failure does not change the account

#### Scenario: Switching tabs during confirmation

- **WHEN** an email-change request is pending and the user leaves and returns to About
- **THEN** the pending lock prevents duplicate requests
- **AND** the input and eventual failure or confirmation instructions remain available
