## MODIFIED Requirements

### Requirement: Auth plugin

`@forge/auth` SHALL provide `LoginForm`, `AuthLayout`, sign-in/out controls,
password recovery/reset/change forms, an access-denied page, and reusable account
profile/security components (`AccountPage`, `AccountSecurity`, `AgentKeys`).

#### Scenario: Connecting authentication UI to the host

- **WHEN** a host integrates the shared authentication components
- **THEN** It SHALL accept
  host callbacks, destinations and translated labels, prevent duplicate submissions
  and retain entered values after failures. Credentials SHALL NOT be persisted in
  browser storage. Optional Google sign-in SHALL appear only when configured.
  The host SHALL own sessions, OAuth, password policy, reset-token validation,
  email delivery, rate limiting and navigation. Auth SHALL NOT install a provider.

#### Scenario: Password recovery

- **WHEN** a visitor requests password recovery
- **THEN** the UI invokes the host callback and presents neutral confirmation
- **AND** the host validates reset links and performs password changes on the server

The account page SHALL provide a default profile summary, editable name, read-only
email and About/Security tabs. Hosts MAY supply their own summary and routed content
instead, preserving custom forms and navigation without mounting duplicate default
panels. Key creation SHALL be available only when the host supplies its callback;
listing and confirmed deletion SHALL remain available independently. Keys SHALL
support names, expiry within 90 days and Created/Last used/Expires metadata with
explicit expired and host-supplied revoked status.
A newly created secret SHALL appear only once and SHALL be cleared on dismissal
or unmount; key lists SHALL contain metadata only. Deletion SHALL require confirmation.

Account security SHALL distinguish a session's recorded sign-in method from its
linked providers, including unknown provenance for older sessions. Password controls
SHALL appear only for credential accounts with the corresponding host integration.
Session lists SHALL identify the current session and offer logout only for others.
The UI SHALL preserve drafts after failures, prevent concurrent submissions and
support translated labels, loading, empty, error and retry states.

Hosts SHALL own encryption, verification and last-use tracking, persistence,
expiry enforcement, migrations and fresh authorization. Hosts SHALL reject foreign
key/session operations and current-session revocation regardless of UI state.
Session tokens, key hashes and ciphertext SHALL NOT enter the UI data contract.

#### Scenario: Create a named key and retry a failure

- **WHEN** a key creation callback fails
- **THEN** the UI retains the name and expiry and permits retry without duplicate requests
- **WHEN** creation succeeds
- **THEN** the UI displays the returned secret once, clears it on dismissal, and lists metadata only

#### Scenario: Review a GitHub account and revoke another session

- **WHEN** the host supplies a GitHub account without a credential provider
- **THEN** account security shows the recorded sign-in method without password controls
- **AND** the user can request logout of another session but not the current session
- **AND** the host verifies session ownership before revocation

#### Scenario: Preserve a host profile and restricted key management

- **WHEN** a host supplies its own summary, routed profile content and no key-creation callback
- **THEN** its forms, navigation, avatar actions and validation remain in control of the host
- **AND** default About/Security panels and key creation controls are absent
- **AND** owned keys can still be listed and deleted with confirmation, including revoked keys
- **AND** the host enforces creation and deletion permissions on every server request

## ADDED Requirements

### Requirement: Account plugin sections

`AccountPage` SHALL accept host-authorized plugin tabs with unique IDs excluding
`about` and `security`, translated labels and content. About and plugin panels
SHALL mount immediately and retain drafts across tab switches. Security SHALL
unmount when inactive to clear secrets. Controlled values/callbacks SHALL support
host URL state while uncontrolled and custom-content usage remain compatible.
Plugin fields SHALL stay in their own tabs; URL state SHALL NOT include form values.

#### Scenario: Switch between account sections

- **WHEN** a user edits a supplied plugin field and switches tabs using a pointer or keyboard
- **THEN** the field retains its draft on return and hidden panels remain inaccessible to focus
- **AND** supplied panels initialize before selection, with hosts controlling loading and subscriptions

#### Scenario: Remove the selected plugin section

- **WHEN** the host removes a selected plugin tab
- **THEN** the adapter validates the selected ID, falls back to About and unmounts the removed panel, discarding its draft
- **AND** showroom URLs restore the available selection on reload and Back/Forward

### Requirement: Account email change requests

Auth SHALL provide optional `AccountEmailChange` UI, also through
`AccountPage.onChangeEmail`, for any host-authorized account without an admin
restriction. It SHALL mark the email field required, block concurrent submissions,
retain failed input and reserve feedback space. Success SHALL clear input and
request confirmation without changing identity. Hosts SHALL own authorization,
validation, CSRF protection, throttling, delivery and confirmation-token validity.

#### Scenario: An authorized member requests an email change

- **WHEN** the host supplies the callback for a non-administrator account
- **THEN** the required field shows a visible asterisk hidden from assistive technology and retains native required semantics
- **AND** the callback receives the requested address while the host derives the target from a fresh session
- **WHEN** the request succeeds
- **THEN** the form reports confirmation is required without replacing the current email or marking it verified
- **AND** later requests remain possible under host policy; request feedback does not persist across reloads

#### Scenario: A pending or failed request

- **WHEN** a user submits twice or switches tabs during a pending request
- **THEN** the host callback runs once and the form remains pending on return
- **WHEN** the request fails
- **THEN** the entered address remains available for retry and feedback does not move the submit button

#### Scenario: Install the optional request form

- **WHEN** a host installs Auth source
- **THEN** no provider endpoint is enabled and no account identity changes
- **AND** the host must wire authorized requests and provider confirmation before enabling the form
