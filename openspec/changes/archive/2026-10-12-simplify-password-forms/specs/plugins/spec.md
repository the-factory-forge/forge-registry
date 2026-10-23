## ADDED Requirements

### Requirement: Single-entry password forms

Auth reset and change forms SHALL collect only the new password, without a
confirmation field. Signed-in change forms, including account security, SHALL NOT
collect the current password. The change callback SHALL receive `{ newPassword }`.
Forms SHALL enforce the host-supplied length policy, block concurrent submissions,
retain failed drafts and clear credentials after success. Hosts SHALL validate
reset tokens or the signed-in session on the server, enforce password policy,
CSRF protection, session revocation and onboarding rules, and derive the target
account from trusted server state. Hosts SHALL migrate their UI callbacks and
server handlers together; source installation alone SHALL NOT enable the change.

#### Scenario: Change a password while signed in

- **WHEN** a signed-in user submits a valid new password on the change page or in account security
- **THEN** the form sends only the new password to the host callback
- **AND** the host validates the session and changes only that session user's password
- **AND** neither the current password nor a confirmation is requested

#### Scenario: Reset a forgotten password

- **WHEN** a visitor follows a recovery link and submits a new password once
- **THEN** the host validates the token, including expiry and single-use rules, before changing the password
- **AND** an invalid token produces an error without changing credentials

#### Scenario: Retry a failed password submission

- **WHEN** password validation or the callback fails
- **THEN** the draft remains available, errors are accessible and concurrent submissions are blocked
- **AND** a successful retry clears the password

#### Scenario: Call a change endpoint without a valid session

- **WHEN** a caller bypasses the form and invokes a signed-in password change without a valid session
- **THEN** the host rejects the request without changing any password
