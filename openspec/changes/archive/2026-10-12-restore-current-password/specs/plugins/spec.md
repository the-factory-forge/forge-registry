## MODIFIED Requirements

### Requirement: Single-entry password forms

Auth reset and change forms SHALL collect the new password once, without a
confirmation field. Signed-in change forms, including account security, SHALL
also require the current password. The change callback SHALL receive
`{ currentPassword, newPassword }`. Each password field SHALL have an independent
translated Show/Hide control. The current password SHALL NOT be constrained by
the new-password length policy. Forms SHALL enforce that policy for new passwords,
block concurrent submissions, retain failed drafts and clear credentials and
visibility after success.

Hosts SHALL validate reset tokens for recovery, or a fresh signed-in session and
the current password for authenticated changes. They SHALL enforce password
policy, CSRF protection, session revocation and onboarding rules, deriving the
target account from trusted server state. Hosts that adopted a new-password-only
callback SHALL restore current-password validation with the UI; source installation
alone SHALL NOT enable the change. The showroom SHALL expose authenticated changes
through Account Security and email recovery through sign-in, without a standalone
`/change-password` route. The exported page component MAY remain for existing hosts.

#### Scenario: Change a password while signed in

- **WHEN** a signed-in user submits their current password and a valid new password in account security
- **THEN** the form sends both values to the host callback
- **AND** the host validates the session and current password before changing only that session user's password
- **AND** no new-password confirmation is requested

#### Scenario: Missing or incorrect current password

- **WHEN** the current password is absent
- **THEN** the form prevents submission
- **WHEN** the current password is incorrect or a caller bypasses the form
- **THEN** the server rejects the change without changing credentials

#### Scenario: Reset a forgotten password

- **WHEN** a visitor requests recovery from sign-in and follows a valid recovery link
- **THEN** the reset form requests only the new password
- **AND** the host validates token expiry and single-use rules before changing credentials
- **AND** an invalid token produces an error without changing credentials

#### Scenario: Retry a failed password submission

- **WHEN** password validation or the callback fails
- **THEN** entered values remain available, errors are accessible and concurrent submissions are blocked
- **AND** a successful retry clears and hides both passwords

#### Scenario: Call a change endpoint without a valid session

- **WHEN** a caller invokes a signed-in password change without a valid session
- **THEN** the host rejects the request without changing any password
