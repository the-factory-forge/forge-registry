## MODIFIED Requirements

### Requirement: Employees plugin

`@forge/employees` SHALL provide an admin-only directory, a short creation dialog,
edit/delete dialogs and verification actions.

#### Scenario: Authorizing employee operations and onboarding

- **WHEN** an administrator manages employee accounts
- **THEN** The UI SHALL require the current
  session's admin role. `@forge/employees-server` SHALL provide
  `createEmployeeService` around the host's Better Auth admin API, validate inputs
  and reject missing, banned, non-admin or onboarding actors.

#### Scenario: Creating a password-free employee account

- **WHEN** an administrator creates an employee account
- **THEN** Creation SHALL accept
  name, email and role without an administrator-supplied password. The host SHALL
  issue a cryptographically random, expiring, single-use invitation through which
  the recipient chooses their own password. Forge default links SHALL expire after
  one hour. Before acceptance the account SHALL have no assigned password and SHALL
  remain pending onboarding.

#### Scenario: Completing employee invitation acceptance

- **WHEN** a recipient accepts a valid employee invitation
- **THEN** Successful acceptance SHALL preserve its role, clear
  the pending flag, mark the invited email address verified, and revoke existing
  sessions and outstanding links. Verification SHALL be persisted before automatic
  sign-in and SHALL remain valid if subsequent session creation fails.

#### Scenario: Rejecting invalid ownership proofs

- **WHEN** an invitation is invalid or expired, or a signed-in user changes a password
- **THEN** Invalid or
  expired invitations and ordinary signed-in password changes SHALL NOT establish
  email ownership. Adoption SHALL NOT retroactively verify existing accounts without
  proof of address ownership.

#### Scenario: Entering the site after activation

- **WHEN** employee invitation acceptance has completed
- **THEN** After acceptance,
  the host SHALL sign in the recipient with their chosen password and enter the
  localized destination allowed for their role. The recipient SHALL be derived from
  the validated invitation, not an arbitrary submitted email. If session creation
  fails after activation, the host SHALL preserve activation and offer ordinary login
  without requiring reuse of the consumed token.

#### Scenario: Delivering and recovering invitations

- **WHEN** the host creates or resends an employee invitation
- **THEN** The host SHALL await invitation delivery and report its actual result. Failed
  delivery SHALL preserve the newly created account and expose a resend action
  without repeating creation. Unconfigured delivery SHALL prevent creation. Resending
  SHALL replace previous links. Administrator account changes SHALL invalidate
  outstanding access links. Public password recovery SHALL retain neutral responses.
  Existing temporary-password accounts SHALL retain their onboarding guard until
  setup completes; adoption SHALL NOT reset existing credentials or migration history.

#### Scenario: Changing an employee account

- **WHEN** an administrator edits an employee account
- **THEN** Editing an email SHALL reset verification only when it changes; administrators
  SHALL NOT demote themselves.

#### Scenario: Showing employee state

- **WHEN** the directory displays employee verification or access state
- **THEN** Active/verified states SHALL use success colors, unverified states pending colors,
  and disabled access canceled colors. The list SHALL NOT expose an access toggle.

#### Scenario: Controlling public profile visibility

- **WHEN** a host offers employee profile publication
- **THEN** Hosts MAY supply public-profile visibility independently of account access.
  The edit-dialog status SHALL become an immediate toggle only when the host
  provides a visibility callback. The directory SHALL preview the change while
  pending and restore the previous status on failure, preserving unsaved account
  fields. The host SHALL authorize, validate and persist publication separately
  from account updates and refresh the employee data. Without the callback, the
  status SHALL remain read-only.

#### Scenario: Inviting an employee

- **WHEN** an administrator submits a valid name, email and role
- **THEN** a pending account is created without credentials and receives a setup link
- **AND** accepting that link sets the recipient's chosen password with the assigned role
- **AND** replaying, replacing or expiring the link prevents subsequent acceptance

#### Scenario: An invited user chooses their password

- **WHEN** an eligible recipient accepts a valid invitation and sets their password
- **THEN** the host creates a session and opens their localized permitted destination without another login form
- **AND** the stored account, new session and refreshed directory show the invited email as verified
- **AND** cached data from a previously signed-in account is cleared
- **AND** failed session creation leaves activation complete and ordinary login available
- **AND** invalid, expired or consumed invitations do not grant access

#### Scenario: Invitation delivery fails

- **WHEN** the account is created but email delivery fails
- **THEN** the administrator sees the failure and can resend for that same account
- **AND** the creation form prevents accidentally creating a duplicate

#### Scenario: Toggling an employee's website visibility

- **WHEN** an administrator activates the edit-dialog visibility toggle
- **THEN** the host visibility callback runs without submitting account edits
- **AND** duplicate actions are disabled until it finishes
- **AND** a failed save restores the prior status and shows a retryable error

#### Scenario: An ordinary employee opens employee management

- **WHEN** the current session lacks the admin role
- **THEN** employee management UI renders nothing and protected operations fail
- **AND** the host guards the route before loading employee records

### Requirement: Customers plugin

`@forge/customers` SHALL provide a searchable directory, a creation page and an
About editor for customer contact, company and address fields.

#### Scenario: Integrating customer records and access

- **WHEN** a host displays, creates or edits a customer
- **THEN** Company name
  SHALL take precedence over contact name when displaying a customer. Optional
  host callbacks SHALL enable deletion, verification and impersonation actions.
  The detail page SHALL accept host-supplied Projects and Sync content. Customers
  SHALL NOT install project persistence, a sync provider or customer file storage.
  Customer creation and editing SHALL submit contact fields without passwords.
  A host that provisions account access SHALL issue an expiring, single-use invitation
  so the recipient chooses their own password. Records without email SHALL remain
  supported; the host owns invitation eligibility, delivery and acceptance.
  Verified/unverified indicators SHALL use success/pending colors; disabled access
  SHALL use canceled colors.

#### Scenario: Offering customer verification choices

- **WHEN** a host offers customer email verification through a badge
- **THEN** Customer email verification badges in the detail summary and table SHALL offer
  Verified and Unverified choices when a host verification callback is supplied.
  Without that callback they SHALL remain informational. Verification changes SHALL
  preserve contact drafts, update optimistically and roll back on rejection.
  Account bans SHALL remain outside this action. Hosts SHALL authorize each write.

#### Scenario: Changing customer verification

- **WHEN** staff select a verification state from a customer badge
- **THEN** the host receives the customer ID and selected verification value
- **AND** pending controls prevent conflicting writes and successful updates show a toast
- **AND** a rejection restores the prior state, retains drafts and allows retry in the menu

#### Scenario: Composing a customer's projects

- **WHEN** a host supplies project content for a customer
- **THEN** the customer's Projects section renders that content
- **AND** the host owns fetching, authorization, persistence and navigation
