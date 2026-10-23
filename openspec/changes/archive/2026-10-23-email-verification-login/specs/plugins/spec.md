## ADDED Requirements

### Requirement: Email verification login feedback

Auth SHALL support an editable initial email and optional verification result.
Success SHALL show one translated dismissible toast per form mount; failure SHALL
show recovery guidance without a success toast. Hosts SHALL verify tokens on the
server and return to localized login at their configured origin with the recipient
email. Provider errors SHALL override success hints. Presentation state SHALL NOT
grant sessions or verify accounts.

#### Scenario: Follow a valid confirmation email

- **WHEN** a guest follows a valid verification link
- **THEN** the provider verifies the account and returns to localized login
- **AND** the email is prefilled, remains editable and a translated toast confirms verification
- **AND** sign-in and required password changes retain their existing behavior

#### Scenario: Follow an invalid confirmation email

- **WHEN** the verification provider rejects a link
- **THEN** login shows recovery guidance and no success toast
- **AND** the account remains unverified and the password field remains usable

#### Scenario: Issue an email without an explicit callback

- **WHEN** a host sends verification mail with an absent or root callback
- **THEN** its delivery adapter supplies the localized login destination and recipient
- **AND** HTML and plain text retain the same issued token and confirmation URL

#### Scenario: Existing host installation

- **WHEN** a host omits the new optional login props
- **THEN** the form retains its normal sign-in behavior without verification feedback
- **AND** installing source does not change routes, token policy, account state or email delivery
