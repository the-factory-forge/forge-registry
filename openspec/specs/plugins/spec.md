# Plugins

## Purpose

Define a Forge plugin and describe the optional application features distributed
by forge-registry. Read this with [Shared UI](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md) and
[Registry distribution](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/registry-distribution/spec.md). The registry manifest
owns the exact shipped files and dependencies; linked guides explain adapters.

## Definition

A **Forge plugin** is an optional, cohesive application feature distributed as
editable source through one or more `@forge` registry items. It combines related
screens or embeddable components with exported types, translated labels and
integration contracts. It is larger than a single UI primitive, but it does not
own the host website or require a runtime plugin loader.

Shared plugin UI is a reusable skeleton for generating websites. Data plugins
provide optimistic UI changes through TanStack Query while hosts retain authoritative
data and transport. Ordinary asynchronous completion belongs to the submitting view.
Site-specific fields, assignment rules and workflows belong in the consuming website.

A **service plugin** provides a shared application capability without its own
user-facing screen. Mailing is a service plugin used by features that send email.
Its renderer and server transport remain separate entrypoints.

A **server companion** is a separately installable item that implements a
plugin's server operations, persistence or authentication integration. Its
entrypoint is server-only. A companion belongs to its parent plugin and is not
a second user-facing feature. A plugin can work with host callbacks or a host
implementation of its client contract without its optional companion.

A **host adapter** connects the installed source to a website's routes, session,
transport, storage, email, locale and theme. Hosts keep adapters outside files
managed by registry installation. A **showroom example** is a mock integration,
not production storage or an authorization mechanism.

This definition concerns Forge website features. It does not describe browser
extensions, Codex tool plugins or Better Auth plugins. Forge business tables
belong to the host Drizzle schema, separately from Better Auth configuration.

## Available plugins

| Plugin       | What it does                                                                                       | Server companion                              | Integration guide                                       |
| ------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Auth         | Account profile/security, sign-in/out, password recovery/change and access-denied UI               | Host authentication provider                  | [Auth](../../../docs/intranet-auth.md)                  |
| Employees    | Admin-only employee directory, creation, editing, verification and account deletion                | `@forge/employees-server`                     | [Employees](../../../docs/intranet-auth.md#employee-ui) |
| Customers    | Customer records, editable verification badges and optional Projects and Sync sections             | `@forge/customers-storage`                    | [Customers](../../../docs/customers.md)                 |
| Projects     | Basic project forms, editable status badges and Details/Drive composition                          | `@forge/projects-storage`                     | [Projects](../../../docs/projects.md)                   |
| Drive        | Entity-scoped spaces, folder actions, directory uploads, duplication, opt-in trash and restoration | `@forge/drive-storage`                        | [Drive](../../../docs/drive.md)                         |
| Blogs        | Multilingual Markdown articles, categories, draft/publish workflow and public pages                | `@forge/blogs-storage`                        | [Blogs](../../../docs/blogs.md)                         |
| Menus        | Restaurant menu items, prices, categories, labels, public menus and A4/A5 printing                 | `@forge/menus-storage`                        | [Menus](../../../docs/menus.md)                         |
| Mailing      | Branded transactional HTML and plain-text email shared by other plugins                            | Separate server transport in `@forge/mailing` | [Mailing](../../../docs/mailing.md)                     |
| Reservations | Fixed-duration appointments or overnight stays, calendars, policies and private guest management   | `@forge/reservations-storage`                 | [Reservations](../../../docs/reservations.md)           |

## Requirements

### Requirement: Standalone item editor feedback

Standalone blog, menu item, customer and project editors SHALL keep actions sticky
within their form at the viewport bottom. Invalid submission SHALL preserve drafts,
reveal the required language, and scroll to and focus the first invalid field in
form order. Each error SHALL have destructive styling and an associated inline
message. Editing SHALL clear field feedback without moving focus. Server validation
SHALL remain authoritative.

#### Scenario: Correcting an item

- **WHEN** staff submit an item with missing or invalid values
- **THEN** the first correction is visible, focused and identified by text and danger color
- **AND** the actions remain usable while scrolling, including on narrow screens
- **AND** actions wrap, respect device safe areas and retain permission and pending states
- **AND** correcting and resubmitting advances to the next remaining correction

#### Scenario: Missing translation or incomplete draft

- **WHEN** a menu item is missing a base-language name while another tab is open
- **THEN** saving reveals the base language and focuses the missing field
- **WHEN** a blog lacks required publication content or a selected category translation
- **THEN** publishing identifies the relevant field or category without losing the draft
- **AND** publication requirements appear beside the correction instead of a permanent generic hint
- **AND** saving an incomplete draft does not require publication-only fields

### Requirement: Optional source installation

Plugins SHALL install through their declared `@forge` items with complete files,
styles and dependencies. Browser exports SHALL remain framework-neutral and
SHALL NOT import server companions or secrets. Installation SHALL NOT register
host routes, grant access, apply database migrations or deploy a website.
Hosts SHALL enable the features they need and retain control of their adapters.

#### Scenario: Installing a plugin

- **WHEN** a host installs a plugin or its server companion
- **THEN** it receives editable source and explicit integration contracts
- **AND** host setup and reviewed migrations remain explicit actions
- **AND** unrelated features are not enabled automatically

### Requirement: Consistent plugin presentation

Plugin pages and their composed controls SHALL follow Shared UI for semantic
colors, status placement, action icons, icon control tooltips, spacing, pointer
cursors, keyboard focus, translations and responsive layouts. Cards and detail summaries SHALL put their
primary status at the top right; tables SHALL retain their status columns.
Errors SHALL use destructive tokens. Statuses SHALL include visible text and
semantic background/foreground pairs independent of customer brand colors.

#### Scenario: Scrolling a plugin table

- **WHEN** a table overflows horizontally at any viewport width, including mobile
- **THEN** its action header and row action cells SHALL remain pinned to the right edge
- **AND** the remaining columns SHALL scroll beneath a themed action surface without obscuring the controls
- **AND** action order, tooltips, keyboard focus, disabled states and deletion confirmation SHALL remain available

#### Scenario: Choosing editors and action feedback

- **WHEN** a plugin presents editing or mutation feedback
- **THEN** Short actions SHALL use dialogs and complex editors SHALL use dedicated pages.
  Plugins SHALL reuse shared table and search components where applicable, retain
  user input after failed mutations and expose loading, empty and error states.
  Brief successful save, update and action confirmations SHALL use dismissible,
  fixed toasts without moving page content. They SHALL announce the result, retain
  keyboard focus and expire after five seconds, paused while hovered or focused.
  Validation errors, recovery instructions and booking receipts SHALL remain with
  their controls or content. Standalone plugin entrypoints SHALL provide their own
  toast context; a persistent host provider SHALL support a shared queue across
  client-side navigation. Hosts SHALL be able to translate messages and dismissal.
  All plugin notifications, including Drive, SHALL reuse the renderer, bottom-right
  queue and status/action footer from Shared UI's shared toast presentation contract.

#### Scenario: Discovering plugin examples

- **WHEN** a user looks for a plugin or server companion in the showroom
- **THEN** Every user-facing plugin SHALL have a discoverable showroom example under All
  and Plugin. Server companions SHALL be documented with their parent's example.

#### Scenario: Moving between plugins

- **WHEN** a staff member opens a different plugin
- **THEN** familiar actions retain their icons, accessible names, spacing and cursors
- **AND** statuses retain their meaning and readable text in both themes

#### Scenario: Sharing loading feedback

- **WHEN** a host mounts the shared loading provider and indicator beneath its navbar
- **THEN** plugin read and refresh states contribute to one activity queue
- **AND** the indicator waits 300ms after the final activity finishes before hiding, including failed operations
- **AND** unmounting releases activity, nested providers reuse the queue, and hooks preserve behavior without a provider

#### Scenario: Refreshing plugin data

- **WHEN** a plugin offers refresh or reload, including error recovery
- **THEN** the control shows only `RefreshCwIcon`, with its translated accessible name and matching icon tooltip
- **AND** existing callbacks, pending/disabled behavior and keyboard activation remain intact

#### Scenario: Saving a project or another plugin record

- **WHEN** a save completes successfully
- **THEN** a fixed toast confirms the update without moving the form or stealing focus
- **AND** a later successful save can show the confirmation again after dismissal
- **AND** a failed save retains the user's draft and displays its error beside the form

### Requirement: Optimistic plugin actions

Predictable data mutations in Employees, Customers, Projects, Blogs, Drive, Menus
and Reservations SHALL update visible records, statuses, ordering or lists before
the response using TanStack Query. Rejection SHALL remove only the temporary
change, retain current host data and show a translated error. Forms SHALL retain
drafts and destructive confirmations SHALL retain recovery controls.

#### Scenario: A mutation is rejected

- **WHEN** a user confirms deletion, changes a record or reorders items
- **THEN** the view updates before the request completes
- **AND** rejection restores the prior view without overwriting unrelated host updates
- **AND** error feedback and retry controls remain available

#### Scenario: A save succeeds

- **WHEN** the server returns a saved record or the host refreshes data
- **THEN** the UI reconciles canonical IDs, versions, ordering and permissions
- **AND** temporary records are removed and success feedback follows confirmation

### Requirement: Optimistic mutation isolation

Hosts SHALL retain transport, authorization, cache keys and route ownership.
Existing callbacks and clients SHALL remain compatible. Standalone plugin
instances SHALL work without a mandatory provider or shared server-process
Query state. Pending mutations SHALL prevent duplicate submissions and mutations
against temporary records. UI mutations SHALL NOT retry automatically, queue
for reconnect or persist callbacks or private records to browser storage.

#### Scenario: Changing scope during a request

- **WHEN** a user changes resource, account or filtered page during a mutation
- **THEN** temporary data is not applied to another scope
- **AND** optimistic state grants no access to protected data

#### Scenario: An ordinary mutation outlives its owner

- **WHEN** a client or resource is replaced, or its view unmounts, before completion
- **THEN** the old result SHALL NOT overwrite the new draft, close its dialog or emit completion feedback
- **AND** a replacement operation SHALL retain its own pending state
- **AND** the request MAY still finish on the server
- **AND** confirmed deletion and Drive recovery SHALL retain their separately specified lifetimes

#### Scenario: History publication starts

- **WHEN** the user accepts a publication plan and publishing starts
- **THEN** Blogs SHALL preview Published until the request settles
- **AND** rejection SHALL remove the preview and retain recovery controls

#### Scenario: Installing updated source

- **WHEN** a consumer installs an updated plugin
- **THEN** its declared dependencies include the optimistic mutation utility
- **AND** existing data callbacks remain usable without adopting showroom infrastructure

#### Scenario: Refreshing an unsubmitted customer or project deletion

- **WHEN** a Customer or Project confirmation is open before submission
- **THEN** its target ID stays fixed while its displayed name follows current host data
- **AND** removing that record or changing the view closes the confirmation

#### Scenario: Refreshing a submitted customer or project deletion

- **WHEN** host data removes a Customer or Project, or its view changes during deletion
- **THEN** the submitted callback finishes against its original ID
- **AND** row or trigger removal does not discard the confirmation while its owner remains mounted
- **AND** rejection retains current host data and shows an error without restoring stale records
- **AND** retry requires the original record in the same view with deletion still enabled

#### Scenario: Returning from customer or project deletion

- **WHEN** a Customer or Project confirmation closes
- **THEN** focus returns to its original trigger if available, otherwise to the owning list or form
- **AND** completion does not move focus or show feedback after the owner unmounts

### Requirement: Server-confirmed operation results

Authentication, impersonation, file transfer, email delivery, management-link
revocation and new booking receipts SHALL retain server-confirmed completion.
Navigation needing a server-issued ID SHALL wait for it. Success toasts SHALL
follow the server response. Rescheduling MAY preview returned availability-slot
endpoints while retaining server capacity checks and final resource assignment.

#### Scenario: A reservation move fails

- **WHEN** the selected slot becomes unavailable before the server saves it
- **THEN** the preview reverts to the existing reservation
- **AND** the form retains the requested values and displays the failure

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

### Requirement: Host-owned authorization and data

Hosts SHALL supply business data, branding, translations, route destinations and
fresh server authorization. UI capabilities and hidden controls SHALL NOT replace
server permission checks. Plugin clients SHALL report safe errors without
exposing credentials, database details or another user's private data.
Server operations SHALL validate inputs and documented concurrency rules.

#### Scenario: A hidden action is called directly

- **WHEN** an unauthorized user bypasses the UI and submits a protected operation
- **THEN** the host or server companion rejects it using fresh authorization
- **AND** no mutation is performed

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

### Requirement: Agent key selection and bulk deletion

Auth agent-key tables SHALL support row selection, mixed-state select-all and a
persistent bulk delete action, disabled with neutral pagination colors when no
rows are selected. Confirmation SHALL identify selected keys and
reuse the existing per-key callback. Failed keys SHALL remain selected for retry
without repeating successes. Loading, errors and pending operations SHALL disable
selection and deletion. Labels SHALL be host-overridable; authorization remains
host-owned.

#### Scenario: Select some or all keys

- **WHEN** a user selects one of several key rows
- **THEN** the header checkbox shows its mixed state and the bulk delete action becomes enabled
- **WHEN** the user activates select-all and then activates it again
- **THEN** all supplied rows are selected and then none are selected
- **AND** keyboard activation exposes the same states without moving table rows
- **AND** removed or unavailable metadata no longer contributes to selection

#### Scenario: Cancel or confirm bulk deletion

- **WHEN** a user opens bulk deletion
- **THEN** the confirmation names only the selected keys
- **AND** cancel leaves keys and selection unchanged without calling the host
- **WHEN** the user confirms
- **THEN** each selected key is passed once to the existing deletion callback
- **AND** selection controls and duplicate deletion remain disabled until completion
- **AND** key rows remain visible until the host supplies updated metadata
- **AND** the shared deletion session owns confirmation, pending state and failure-only retry
- **AND** unmounting the key control stops later calls without claiming to cancel an already sent request

#### Scenario: Retry partial deletion failure

- **WHEN** one selected key fails to delete and another succeeds
- **THEN** remaining deletions are still attempted and the error identifies retryable keys
- **AND** successful keys leave the selection and confirmation
- **WHEN** the user retries
- **THEN** only the failed keys are submitted again

### Requirement: Single-entry password forms

Auth reset and change forms SHALL collect the new password once, without a
confirmation field.

#### Scenario: Submitting reset and change forms

- **WHEN** an auth reset or change form is presented or submitted
- **THEN** Signed-in change forms, including account security, SHALL
  also require the current password. The change callback SHALL receive
  `{ currentPassword, newPassword }`. Each password field SHALL have an independent
  translated Show/Hide control. The current password SHALL NOT be constrained by
  the new-password length policy. Forms SHALL enforce that policy for new passwords,
  block concurrent submissions, retain failed drafts and clear credentials and
  visibility after success.

#### Scenario: Enforcing host password-change authority

- **WHEN** a host handles recovery or authenticated password changes
- **THEN** Hosts SHALL validate reset tokens for recovery, or a fresh signed-in session and
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
  Row controls SHALL follow [stable table row actions](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-stable-table-row-actions),
  including disabled self-delete and unavailable verification/invitation controls.

#### Scenario: The current employee cannot delete their own account

- **WHEN** an administrator views their own employee row alongside other employees
- **THEN** every row shows verification/invitation, edit and delete in the same positions
- **AND** self-delete remains visible and disabled without opening a confirmation or invoking deletion
- **AND** another employee's enabled delete action still requires confirmation

#### Scenario: Verification is unnecessary or unavailable

- **WHEN** an employee has a verified email and no pending invitation, or the account is banned
- **THEN** the send action remains visible and disabled without moving edit or delete
- **AND** an eligible pending invitation retains resend even if the email is already verified

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

### Requirement: Employee deletion with related data

Employees SHALL support host-provided deletion previews grouped by data source,
with links, explicit decisions and optional replacement identities. Single and bulk
deletion SHALL use the same configured adapter. Hosts SHALL validate fresh admin
authorization, preview versions, complete choices and eligible replacements, then
atomically process related data and account removal. Self-deletion SHALL fail.
The default provider-removal path SHALL NOT bypass a configured transaction.

#### Scenario: Reviewing articles and another plugin's records

- **WHEN** an administrator opens deletion for an employee with related records
- **THEN** the dialog shows each supplied group and expandable affected-item links
- **AND** confirmation requires the group's valid choice and any required replacement

#### Scenario: Related data changes or processing fails

- **WHEN** confirmation uses a stale preview or any related operation fails
- **THEN** no partial account deletion is reported as successful
- **AND** the dialog retains feedback and can reload the preview

### Requirement: Optional optimized employee photos

Employee photo controls SHALL remain optional and show a placeholder without a
photo. Configured uploads SHALL use the shared crop dialog to prepare WebP bytes
before upload. Hosts MAY override output dimensions. Invalid images and failed
uploads SHALL preserve other edits and allow retry or cancellation.

#### Scenario: Uploading or omitting a photo

- **WHEN** an employee has no photo
- **THEN** the photo control imposes no required-file validation
- **WHEN** the employee selects an image
- **THEN** crop confirmation prepares the configured WebP output before upload
- **AND** host adapters follow [the upload contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/host-integration/spec.md#requirement-user-uploaded-file-persistence) through existing optional photo callbacks
- **AND** a successful upload stores the bytes in S3 and persists only metadata and a durable reference in PostgreSQL

#### Scenario: Employee photo upload fails

- **WHEN** image decoding or the host upload fails
- **THEN** accessible feedback supports retry or cancellation
- **AND** unrelated form values remain intact
- **AND** missing or unavailable S3 leaves the previous photo unchanged without a database-byte fallback

#### Scenario: An existing host does not enable photo uploads

- **WHEN** the host omits the optional photo upload callback
- **THEN** employee management remains usable without an upload feature or required S3 configuration
- **AND** installing Employees does not create photo storage, public profiles or a data migration

### Requirement: Employee photo access and lifetime

Hosts SHALL validate file bytes and fresh authorization before photo writes and
authorize reads independently of object keys under the host's access policy.
Public profiles and their publication rules SHALL remain host-owned.
Replacement, canceled edits and employee deletion SHALL preserve referenced
photos and retain recoverable cleanup information for
unreferenced objects. A failed S3 deletion SHALL NOT lose the cleanup reference.

#### Scenario: Reading an employee photo

- **WHEN** a caller requests an employee photo
- **THEN** the host authorizes the request under its existing photo access rules
- **AND** knowing an asset ID or S3 key does not grant access to a protected photo
- **AND** installing Employees does not introduce public profiles or change the host's publication rules

#### Scenario: Replacing a photo or canceling an edit

- **WHEN** a replacement upload fails or the editor discards the new selection
- **THEN** the previously saved profile and photo remain readable
- **AND** uploaded but unreferenced objects can be cleaned without deleting a referenced photo

#### Scenario: Removing an employee while storage is unavailable

- **WHEN** authorized employee deletion commits but S3 object removal fails
- **THEN** removed employee references no longer grant access to their photos
- **AND** durable cleanup references survive account deletion and allow removal to be retried
- **AND** related-data decisions retain their existing database transaction guarantees

### Requirement: Customers plugin

`@forge/customers` SHALL provide a searchable directory, a creation page and an
About editor for customer contact, company and address fields.
The creation header SHALL show a fixed-size avatar using the current draft's initials.
Single-record deletion SHALL follow the target, refresh and focus behavior in
the optimistic mutation isolation requirement.

#### Scenario: Integrating customer records and access

- **WHEN** a host displays, creates or edits a customer
- **THEN** Company name
  SHALL take precedence over contact name when displaying a customer. Optional
  host callbacks SHALL enable deletion, verification and impersonation actions.
  The detail page SHALL accept host-supplied Projects and Sync content. Customers
  SHALL NOT install project persistence, a sync provider or customer file storage.
  Customer creation and editing SHALL submit contact fields without passwords.
  A host that provisions account access SHALL issue an expiring, single-use invitation
  so the recipient chooses their own password. Creation and editing SHALL require a real, unique email. The host owns
  invitation delivery and acceptance. Existing email-less records SHALL remain
  untouched until a separate host adoption decision; new accounts SHALL NOT use
  placeholder addresses or silently attach an existing identity.
  Verified/unverified indicators SHALL use success/pending colors; disabled access
  SHALL use canceled colors.

#### Scenario: Previewing a customer avatar during creation

- **WHEN** staff type or clear company, contact name or email fields before saving
- **THEN** the creation avatar updates immediately using company name, contact name, then email in that order
- **AND** empty or whitespace-only values show `?` without changing the avatar's size

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

### Requirement: Projects plugin

`@forge/projects` SHALL provide `ProjectsPage`, embeddable `ProjectsList`, creation
and detail pages.
Single-record deletion SHALL follow the target, refresh and focus behavior in
the optimistic mutation isolation requirement.

#### Scenario: Integrating project forms and ownership

- **WHEN** a host installs Projects and connects creation or editing
- **THEN** A project SHALL belong to one customer and may have an assignee,
  description and display image supplied by the host. Shared create
  and edit forms SHALL expose only name, status and description and submit only
  those fields. They SHALL NOT render Website URL, Owner or Assignee inputs or
  require people directories to save. The host SHALL resolve and authorize the
  customer relationship during creation and preserve existing metadata on update.
  Site-specific editors SHALL remain in the host. Details/Drive sections SHALL accept
  host destinations and supplied Drive content. Installing Projects UI SHALL include Customers UI without persistence or uploads.
  Hosts MAY opt into the separate `@forge/projects-storage` companion.
  Requested, prospect, under-construction and production statuses SHALL use
  not-started, informational, pending and success color pairs respectively.

#### Scenario: Changing status through a project badge

- **WHEN** a host provides a project status action
- **THEN** Project status badges in detail summaries and tables SHALL offer the existing
  lifecycle choices through host callbacks. Lists without a status callback SHALL
  remain read-only. Detail pages MAY reuse their existing save callback with saved
  fields and the selected status. Badge updates SHALL preserve unsaved name and
  description fields and synchronize the form status only after success.

#### Scenario: Changing project status without saving a draft

- **WHEN** staff choose a status from a project header or table badge
- **THEN** the badge updates before the host response and competing mutations are disabled
- **AND** success synchronizes the detail form status without saving unrelated draft fields
- **AND** rejection restores the prior badge and retains every draft field with a retryable menu error

#### Scenario: Viewing the project directory

- **WHEN** a host renders the project directory or an embedded project list
- **THEN** the table omits the Website column
- **AND** project detail summaries omit website links and missing-URL placeholders
- **AND** the UI model and labels do not expose a website URL
- **AND** legacy stored URLs remain untouched by this display cleanup

#### Scenario: Viewing projects for one customer

- **WHEN** a host provides a customer-scoped project list
- **THEN** the list includes only that customer's supplied projects and omits a redundant owner column
- **AND** its links preserve the host's customer and project context

#### Scenario: Editing a basic project

- **WHEN** a user opens either shared project form
- **THEN** the editable fields are name, status and description
- **AND** failed saves retain those values without requiring owner or assignee directories

#### Scenario: Saving without changing host metadata

- **WHEN** a host handles the three-field form payload
- **THEN** creation adds an authorized customer relationship from host context
- **AND** updates preserve existing ownership, website URL and assignment unless a separate authorized host action changes them

### Requirement: Drive plugin

`@forge/drive` SHALL provide `DrivePage` and embeddable `DriveBrowser` using a
`DriveClient`.

#### Scenario: Rejecting malformed service requests

- **WHEN** a host passes malformed request data to the server companion
- **THEN** Zod validates the input before its fields reach storage and failures use the plugin's `INVALID` error
- **AND** parsed objects exclude unknown fields while existing authorization and business rules remain enforced
- **AND** optional inputs retain their documented omission semantics

#### Scenario: Integrating the scoped Drive browser

- **WHEN** a host connects the Drive browser to an entity scope
- **THEN** A space SHALL be scoped by host-defined entity type and ID.
  The browser SHALL support folders, sorting, pagination, uploads with progress,
  retry/cancel, downloads, rename and confirmed deletion according to capabilities.
  The browser SHALL combine directory, space and folder navigation into one
  breadcrumb. At the space root, the browser SHALL omit the redundant breadcrumb
  row when neither `backHref` nor `onRenameSpace` is supplied; the sidebar SHALL
  retain the space name and permitted actions. Subfolders, directory return links
  and inline space renaming SHALL retain their breadcrumb row.
  Ancestors SHALL navigate back and clicking the current title SHALL
  enter inline edit mode when renaming is permitted, without an action arrow or
  menu. Keyboard activation SHALL also enter edit mode with the current name
  selected. Enter or leaving the field SHALL save; Escape SHALL discard the draft.
  Pending saves SHALL prevent edits and duplicate submissions, and IME confirmation
  SHALL NOT submit. Folder renames SHALL use the existing
  Drive client and rename capability. Space renaming SHALL require an optional
  host callback, independent of file permissions. The host SHALL validate, authorize
  and persist changes to its record and refresh listing names. Adapters without
  that callback SHALL remain compatible and SHALL NOT offer space renaming.
  Failed renames SHALL retain the inline field and entered name for retry,
  with accessible error feedback that does not move the file table.

#### Scenario: Owning upload state and actions

- **WHEN** the upload queue publishes its state to Drive feedback
- **THEN** the queue SHALL own action eligibility and aggregate loading/completion status
- **AND** feedback SHALL receive presentation data without files, abort controllers or internal lifecycle flags
- **AND** existing retry, cancellation, cleanup, concurrency and toast presentation behavior SHALL remain unchanged

#### Scenario: Reporting upload progress and recovery

- **WHEN** a Drive upload or related asynchronous action is pending or completes
- **THEN** Upload feedback SHALL appear in the browser's fixed toast area without moving
  page content. Each file SHALL retain progress, state and retry/cancel controls.
  Active uploads and failures SHALL stay available until resolved; finished batches
  SHALL dismiss after five seconds, paused while hovered or focused, or on request.
  Asynchronous toast feedback SHALL update in place through loading, success and
  error states. Loading indicators SHALL respect reduced motion. Failed requests
  SHALL retain recovery controls or leave the initiating action available for retry.

#### Scenario: Leaving an upload browser

- **WHEN** a Drive browser with unfinished uploads unmounts
- **THEN** its independently identified batch toast is removed and the existing cancellation behavior runs
- **AND** context-bound Undo controls close with their browser while ordinary confirmations remain in the shared queue

#### Scenario: Connecting scoped Drive storage

- **WHEN** a host connects Drive to entity records and object storage
- **THEN** `@forge/drive-storage` SHALL provide `createDriveStorage`, PostgreSQL metadata,
  private S3-compatible object storage and server-authorized scope access.
  Projects may own spaces; customers reach files through their projects rather
  than a separate customer Drive section. Other features may supply their own scopes.

#### Scenario: Opening another entity's space

- **WHEN** a client requests a Drive space
- **THEN** the host resolves that scope and checks access before listing or mutating files
- **AND** capabilities shown by the browser do not grant server permission

#### Scenario: Navigating within a Drive space

- **WHEN** the host changes the selected folder within the same space
- **THEN** the browser and sidebar SHALL remain mounted, retaining expanded branches and loaded tree pages
- **AND** navigation SHALL load the destination listing without rereading unchanged tree branches
- **AND** mutations and client replacement SHALL still refresh affected listings
- **AND** folder-specific controls SHALL reset, pending uploads SHALL be cancelled, and folder-bound Undo callbacks SHALL remain silent after navigation
- **AND** the host SHALL use its router link adapter and preserve the browser instance for client-side folder navigation

#### Scenario: Embedded root without duplicate context

- **WHEN** a host embeds Drive at its root without a directory return link or space rename callback
- **THEN** no separate root heading is rendered above the sidebar and file table
- **AND** the sidebar root and its permitted actions remain accessible
- **WHEN** a user opens a subfolder
- **THEN** its breadcrumb shows the folder title and a usable link back to the root

#### Scenario: Focusing a single-input dialog

- **WHEN** a user opens a folder creation, rename or duplication dialog using a pointer, touch or keyboard
- **THEN** the editable name field SHALL receive initial focus so typing can begin immediately
- **AND** closing SHALL preserve the existing focus return behavior; deletion confirmations and disabled fields SHALL retain their default focus behavior

#### Scenario: Renaming from the breadcrumb

- **WHEN** an authorized user clicks or keyboard-activates the current title and edits its name
- **THEN** Enter or leaving the field saves and the breadcrumb and subsequent listings show the saved name
- **AND** Escape discards an unsaved draft and returns focus to the title
- **AND** ancestor links remain usable, while a failed save preserves the draft for retry
- **AND** a space without a host rename callback shows no rename action

#### Scenario: Upload feedback

- **WHEN** a user uploads files in a standalone or embedded browser
- **THEN** a fixed toast shows each file's progress and recovery controls without shifting the file table
- **AND** failures remain retryable, large batches scroll, and finished feedback dismisses without removing uploaded files

#### Scenario: Asynchronous operation feedback

- **WHEN** a user downloads a file, undoes trashing or uploads a batch
- **THEN** its toast shows loading feedback and updates in place when the operation settles
- **AND** errors remain recoverable, reduced motion is respected, and file-table content does not shift

#### Scenario: Recovering a Drive listing

- **WHEN** spaces, folder contents, trash, restore destinations or folder-tree pages are reloaded
- **THEN** Drive SHALL retain the last successful listing while pending and disable its mutations and pagination
- **AND** superseded or unmounted reads SHALL NOT update the listing, even if the adapter ignores cancellation
- **WHEN** a read fails
- **THEN** the previous rows or destination options SHALL remain visible with mutations and pagination disabled and Retry available
- **AND** `FORBIDDEN` or `NOT_FOUND` SHALL instead clear the affected listing
- **WHEN** a retry succeeds
- **THEN** Drive SHALL replace table snapshots or append ready folders from a tree cursor page without repeating existing folder IDs, and resume permitted actions
- **AND** tree retries SHALL keep the failed cursor; refreshes and client replacement SHALL restart at the first page and replace retained folders when that read succeeds
- **AND** only accepted successful reads SHALL update the timestamp used to evaluate trash expiry
- **AND** a listing refresh SHALL NOT reset an optimistic mutation that is still pending

#### Scenario: Preparing Drive deletion

- **WHEN** a single-entry or bulk deletion preview is requested
- **THEN** Drive SHALL own its counts and confirmation tokens together and ignore superseded or unmounted preview completions
- **AND** single-entry confirmation SHALL remain available during preparation, await the preview and submit without another confirmation
- **AND** a single-entry conflict SHALL invalidate the token so the next confirmation prepares and submits again; other mutation failures SHALL retain the token for retry
- **AND** bulk deletion SHALL retain its shared Deletion session, refresh only failed entries and require explicit confirmation after refreshed previews
- **AND** host client methods, authorization and trash versus permanent deletion SHALL remain unchanged

### Requirement: Drive folder action menu

Drive folder-tree rows SHALL offer a keyboard- and touch-accessible three-dot menu
with permitted Add > Upload file / Upload folder / Folder, Rename, Duplicate, Download and Move to
trash actions. Actions SHALL target the selected row independently of the open
folder. Labels SHALL remain translatable and theme-aware. Rename and trash SHALL
retain existing validation and confirmation flows.

#### Scenario: Acting on the space root

- **WHEN** a Drive space has a permitted action, including when it has no child folders
- **THEN** its root sidebar row offers the same three-dot menu
- **AND** uploads and folder creation target the root even when another folder or Trash is displayed
- **AND** Rename uses the host's optional space-rename callback and Download archives the complete space
- **AND** space duplication and deletion are omitted because they belong to the host

#### Scenario: Discovering folder actions

- **WHEN** a user browses folders with a mouse
- **THEN** the space-root dots stay visible and child-folder dots appear on row hover or keyboard focus
- **AND** an open menu keeps its dots visible without shifting the folder labels
- **AND** touch devices keep every available folder-menu trigger visible

#### Scenario: Acting on a different folder

- **WHEN** a user opens a folder's tree menu while another folder is displayed
- **THEN** its actions affect the selected folder
- **AND** trashing the open folder or an ancestor offers its parent and authorized Undo
- **AND** Move to trash requires the complete trash integration and never substitutes permanent deletion

#### Scenario: Creating a child folder

- **WHEN** a user chooses Add > Folder on a tree row
- **THEN** the existing creation dialog creates a child of that folder
- **AND** a different open folder never displays the new child during optimistic feedback
- **AND** folder creation remains available with create-folder permission independently of upload permission

### Requirement: Drive folder downloads

Folder downloads SHALL save a ZIP with nested files and empty folders using the
existing authorized reads. The browser SHALL traverse every cursor page, validate
paths, bound memory use and fail without saving a partial ZIP. Download-only
access SHALL suffice without a new client method. Hosts SHALL permit CORS GET
access for signed URLs.

#### Scenario: A folder exceeds browser limits

- **WHEN** the tree exceeds 100 MB of file bytes, 1,000 entries including folders or 100 nested levels
- **THEN** the archive is rejected with a translated limit message and guidance to download smaller subfolders
- **AND** the byte limit covers both declared metadata and actual streamed bytes

#### Scenario: Downloading a folder from another view

- **WHEN** a user with download permission chooses Download on a folder-tree row
- **THEN** the ZIP contains that folder's complete paginated tree, including empty folders
- **AND** the existing download toast reports progress and completion without shifting the table

#### Scenario: Download failure or cancellation

- **WHEN** a read fails, access is revoked, a path is unsafe or a limit is exceeded
- **THEN** no partial ZIP is saved and a translated error allows the user to retry or choose smaller subfolders
- **WHEN** the user leaves the Drive browser during an archive download
- **THEN** active archive reads are cancelled

### Requirement: Drive directory upload

Directory uploads SHALL require upload and folder-creation permissions. The
companion SHALL validate paths and folder depth, preserve subfolders, reuse
matching ready folders and reject file conflicts without overwriting. Each file
SHALL retain its target, path, progress, request identity and retry/cancel behavior.

#### Scenario: Uploading a directory

- **WHEN** a permitted user selects a directory containing nested files
- **THEN** each file retains its relative path inside the selected destination
- **AND** a failed file remains retryable without overwriting or flattening its path
- **AND** unsafe paths and unavailable destinations are rejected by the server
- **AND** the browser picker omits empty directories, while cancellation can leave created folders and completed files

### Requirement: Drive duplication

Duplication SHALL require download, upload and folder-creation permissions. It
SHALL create an independent sibling subtree with fresh entry IDs and a
user-confirmed name atomically. Conflicts, inaccessible IDs and unfinished source
operations SHALL fail without partial copies.

#### Scenario: Duplicating a folder

- **WHEN** a permitted user duplicates a ready folder
- **THEN** its nested entries receive new IDs and the root receives the chosen name
- **AND** renaming or trashing either copy leaves the other unchanged
- **AND** a failed form keeps its entered name for retry

### Requirement: Drive copy storage lifetime

Copies MAY share immutable stored bytes. Permanent deletion SHALL retain bytes
referenced by any other active or trashed entry. All writers and cleanup workers
SHALL adopt reference-aware cleanup before enabling duplication.

#### Scenario: Removing a copy

- **WHEN** either copy is permanently deleted
- **THEN** the surviving copy retains its downloadable bytes
- **AND** a copy in trash remains recoverable until expiry
- **AND** the last permanent removal releases the shared stored bytes

### Requirement: Optional Drive folder operations

`prepareFolderUpload` and `duplicateEntry` SHALL remain optional client methods.
Server authorization SHALL be rechecked under the space lock. Hosts SHALL wire
validated, explicit transport operations. Installation SHALL NOT change a host's
transport, authentication or database automatically.

#### Scenario: An older host adapter

- **WHEN** an adapter omits directory upload, duplication or trash methods
- **THEN** the corresponding menu action is omitted and existing actions continue working
- **AND** UI capabilities never grant server access

### Requirement: Drive upload drop feedback

An upload-enabled Drive browser SHALL highlight its existing file drop area while
files are dragged over it. The overlay SHALL show translated upload guidance,
respect the host theme and retain the table's geometry and upload validation.
Non-file drags and unavailable upload actions SHALL NOT show an upload target.

#### Scenario: Dragging files over the table

- **WHEN** files enter an available upload area
- **THEN** an overlay marks the full drop area and stays visible while crossing its child elements
- **AND** dropping files uses the existing upload queue and folder rejection behavior
- **AND** leaving, dropping, canceling the drag or losing upload availability clears the overlay
- **AND** both themes and narrow layouts retain readable guidance without shifting the table

### Requirement: Drive trash and restoration

The exported Drive Drizzle schema SHALL include trash.
The private Drive recovery module SHALL own Undo, restore attempts and conflict
drafts within the current folder browser, independently of the selected view.

#### Scenario: Enabling trash and recovery capabilities

- **WHEN** a host enables Drive trash or retains a custom adapter without it
- **THEN** Drive SHALL support
  opt-in trash with a 30-day default retention window. Custom adapters without trash
  SHALL remain compatible and
  `deleteEntry` SHALL retain permanent deletion semantics. Trash-enabled browsers
  SHALL use confirmed trash for routine deletion and separately confirmed permanent
  purge. Recovery SHALL require an explicit restore capability; a renamed recovery
  SHALL also require rename permission. Server authorization SHALL remain authoritative.

#### Scenario: Undoing a confirmed trash operation

- **WHEN** a user has just moved a Drive entry to trash
- **THEN** After confirmed trashing, the browser SHALL offer a toast Undo action when restore
  permission is granted. Undo SHALL use the existing authorized restore operation,
  prevent duplicate pending submissions and refresh active/trash listings. Failures
  SHALL remain retryable; location or name conflicts SHALL offer the Trash recovery
  flow without overwriting active files. Permanent deletion SHALL NOT offer Undo.

#### Scenario: Keeping recovery within the current folder browser

- **WHEN** a user changes search, sorting or switches between Files and Trash in the same folder browser
- **THEN** pending recovery SHALL remain active and update the current folder's listings on completion
- **AND** restore conflicts SHALL retain destination/name recovery and failed retries SHALL retain entered choices
- **AND** unconfirmed bulk selections SHALL clear on view changes while confirmed batches retain Deletion session behavior

#### Scenario: Leaving Drive during recovery

- **WHEN** the user changes folders/spaces or the browser unmounts while a deletion or restore is pending
- **THEN** its Undo controls SHALL close and late completions SHALL NOT refresh the departed view, create notifications or reopen recovery
- **AND** already submitted writes MAY finish on their original server
- **AND** replacing only the client within the same browser SHALL preserve recovery, with future Undo and restore retries using the latest client and already submitted writes retaining their original client
- **AND** hosts SHALL still reset Drive when authenticated identity changes

#### Scenario: Retaining and restoring a trash group

- **WHEN** a trashed group is listed, retained or restored
- **THEN** Trash SHALL retain group IDs, descendant relationships, immutable bytes, original
  location and expiry. Trashed groups SHALL remain independent from later deletion
  of their former ancestors. Normal listings, search, downloads and trusted file
  reads SHALL exclude trash. Active names MAY be reused. Restoration SHALL validate
  an available same-space destination and name, expiry and folder depth without
  overwriting existing entries. Unavailable locations or name collisions SHALL offer
  an explicit destination/name recovery flow.

#### Scenario: Guarding trash and expiry cleanup

- **WHEN** Drive validates trashing, permanent purge or expiry maintenance
- **THEN** Trashing SHALL validate the deletion preview and host reference guard and SHALL
  reject unfinished uploads or pending deletion in the affected subtree. Menus
  SHALL reject trashed image references and reads. Trash and pending purge SHALL
  block owning-entity removal. Expiry cleanup SHALL use bounded trusted maintenance
  and durable retries; storage failures SHALL retain recovery metadata until cleanup
  succeeds. Permanent purge SHALL prevent restoration once started.

#### Scenario: Recovering a folder

- **WHEN** an authorized user trashes a folder and restores it before expiry
- **THEN** its IDs, descendants and bytes survive and it returns to its original available folder
- **AND** trash shows its original location and expiry while normal file access excludes it

#### Scenario: Recovering after a location or name conflict

- **WHEN** the original folder is unavailable or an active item now uses the name
- **THEN** recovery refuses to overwrite and offers an available name and same-space folder
- **AND** independently trashed children remain recoverable after their former parent is purged

#### Scenario: Retrying permanent cleanup

- **WHEN** confirmed purge or retention expiry encounters a storage failure
- **THEN** pending metadata survives and a later bounded maintenance pass can finish after restart
- **AND** the pending group cannot be restored or bypass the owning-entity deletion guard

#### Scenario: Protecting in-progress uploads and menu images

- **WHEN** a subtree contains unfinished uploads, pending deletion or a guarded menu image reference
- **THEN** trashing is rejected without removing its files
- **AND** Menus cannot select or read an image already in trash

#### Scenario: Undoing a trash action

- **WHEN** an authorized user activates Undo on the trash confirmation toast
- **THEN** the item returns to its original available location and pending clicks cannot duplicate the operation
- **AND** a failed request remains retryable, while a location or name conflict offers Trash recovery without overwriting files

#### Scenario: Installing Drive

- **WHEN** a host installs Drive
- **THEN** the initial schema supports trash without a separate upgrade
- **AND** transport operations and recovery permission require explicit host adoption, while adapters without trash retain permanent deletion

### Requirement: Blogs plugin

`@forge/blogs` SHALL provide article/category administration, language tabs,
Markdown editing/preview and public list/article pages. Its editor SHALL own
editing, saved state, asynchronous completion and unsaved-change protection
independently of the Menu editor, preserving existing page interfaces. Each
language SHALL retain at most one draft and five publications, including live,
with chronological history and detailed comparison.

#### Scenario: Rejecting malformed service requests

- **WHEN** a host passes malformed request data to the server companion
- **THEN** Zod validates the input before its fields reach storage and failures use the plugin's `INVALID` error
- **AND** parsed objects exclude unknown fields while existing authorization and business rules remain enforced
- **AND** optional inputs retain their documented omission semantics

#### Scenario: Editing and publishing translations

- **WHEN** staff edit or publish a blog article
- **THEN** Articles SHALL
  group translations with independent drafts, publications and retained history.
  Complete content, designated author, image references and category assignments
  SHALL be captured for each saved language state; unpublished edits SHALL NOT
  change a public translation. Missing public translations SHALL NOT silently
  fall back to another language.
  `@forge/blogs-storage` SHALL provide `createBlogsStorage` with PostgreSQL and
  private S3 persistence, fresh staff authorization, version checks and idempotent
  mutations. Blogs SHALL remain independent of Customers, Projects and Drive.
  Published, unpublished changes and draft SHALL use success, pending and
  not-started colors in both list and editor.

#### Scenario: Reading a blog status

- **WHEN** a blog translation is published, has unpublished changes, or is a draft
- **THEN** its editor and list badge use the same green, orange, or gray status pair respectively
- **AND** its translated status remains available as text without relying on color alone

#### Scenario: Submitting public blog search

- **WHEN** a visitor types in or clears the public blog search
- **THEN** Public search SHALL submit after typing pauses without a separate Search button.
  Clearing the field SHALL refresh results. Search SHALL preserve the selected
  category, reset pagination and retain immediate Enter submission through the
  existing GET form.

#### Scenario: Searching public articles

- **WHEN** a visitor finishes typing or clears the search field
- **THEN** the listing updates automatically for that query and the selected category
- **AND** Enter submits immediately without a duplicate delayed submission
- **AND** unfinished text composition does not submit a search

#### Scenario: Editing a published translation

- **WHEN** staff save a new draft for a published language
- **THEN** its status becomes unpublished changes
- **AND** the public page retains its previous publication until staff publish again

#### Scenario: Scrolling the editor history

- **WHEN** staff scroll an article with history open on desktop
- **THEN** the comparison and History buttons stick together with the history panel below the host header offset
- **AND** long timelines scroll inside the panel while the buttons remain visible
- **AND** narrow layouts retain the controls and expanded history in normal page flow

#### Scenario: Opening and closing History

- **WHEN** the Blog History panel opens by default or through its toggle
- **THEN** the toggle has a filled primary treatment and exposes `aria-expanded="true"`
- **AND** closing through the toggle, panel close action or mobile version selection restores its inactive outline and `aria-expanded="false"`

#### Scenario: Computing a draft save

- **WHEN** a storage or showroom adapter saves a blog draft
- **THEN** one pure model operation validates content and computes the article, retained history snapshot and removed history IDs together
- **AND** unchanged content and settings preserve the prior article version, editor and history
- **AND** the operation leaves its caller-owned inputs unchanged
- **AND** the storage adapter retains authorization, locking and atomic persistence of the article, history, projections and retry result

#### Scenario: Keeping an editor draft safe during navigation and refresh

- **WHEN** staff leave an unsaved draft for another language or history version
- **THEN** the editor offers save, discard and cancel; a failed save retains the draft and pending navigation
- **AND** retrying unchanged input retains its request ID and navigation continues only after a successful save
- **AND** explicit article refresh adopts the latest version while retaining dirty content, settings and history origin
- **AND** obsolete history responses cannot replace the current client's headers or selected version
- **AND** clients without history retain direct publication through the existing client interface

#### Scenario: An obsolete Blog editor operation finishes

- **WHEN** a save, refresh, publication, history operation, upload or deletion finishes after its article/language editor or category editor has been replaced, unmounted or given a replacement client
- **THEN** the old completion does not update editor state, produce success/error feedback, invoke host callbacks or resume navigation
- **AND** obsolete publication plans cannot open confirmations or start publication
- **AND** already-submitted server writes may finish without affecting the replacement editor
- **AND** an obsolete attempt cannot clear a newer attempt's pending state or retry identity

#### Scenario: Replacing only the Blog editor client

- **WHEN** the host supplies a different client for the same article/language or category
- **THEN** unsaved inputs remain intact while obsolete pending state, feedback and confirmations are cleared
- **AND** subsequent attempts use the replacement client and a fresh retry identity, even when a prior client object is later reused
- **AND** unchanged retries within the same client retain their request ID and existing version checks
- **AND** current successful saves and confirmed deletions retain their normal host callbacks and navigation

#### Scenario: Browser history leaves an unsaved blog draft

- **WHEN** a host router blocks Back or Forward away from a dirty blog editor
- **THEN** the existing save, discard and cancel dialog resolves the original transition
- **AND** cancel preserves the current language, URL and draft; discard leaves without saving
- **AND** save persists the current language and shared settings before leaving; invalid fields cancel navigation and failures retain the draft for retry
- **AND** pending operations reject new route changes, and replaced editors cannot resume an earlier save's navigation
- **AND** clean navigation and confirmed deletion return normally, without synthetic history entries
- **AND** document exits use the native browser warning while dirty or pending, without repeating it after confirmed Save or Discard

#### Scenario: Browser history leaves an unsaved blog category

- **WHEN** a host router blocks Back or Forward away from an edited or new category
- **THEN** the category editor offers Save category, Discard changes and Cancel
- **AND** Cancel retains all translations, slugs and parent selection; Discard resumes the original transition without saving
- **AND** Save persists before resuming the transition, while errors retain the draft and dialog for retry
- **AND** pending saves reject new route changes, and native unload warns while dirty or pending

### Requirement: Blog content and image persistence

`@forge/blogs-storage` SHALL keep current Markdown and metadata in PostgreSQL
article documents, retained snapshots in separate indexed rows, and image bytes
in private S3. Saves SHALL atomically update content, version, retention,
projections and retry results. Text-only operations SHALL NOT contact S3.
Publication SHALL verify served images, allowing confirmed historical-image
omission under the recovery contract.

#### Scenario: Saving while object storage is unavailable

- **WHEN** an authorized editor saves or publishes an article without images while S3 is unavailable
- **THEN** Markdown and metadata persist together in PostgreSQL
- **AND** a database failure leaves the previous draft and publication intact
- **AND** the operation creates no Markdown object or object-ledger entry

### Requirement: Optional blog image storage

Blogs SHALL remain usable with PostgreSQL when the host has no S3 client or bucket.

#### Scenario: Using Blogs without object storage

- **WHEN** a host runs Blogs without a configured S3 client or bucket
- **THEN** Text creation, reading, editing, category management and publication without images
  SHALL remain available. An authorized image upload without image storage SHALL fail
  with `STORAGE_NOT_CONFIGURED` before reserving or writing an object. The editor SHALL
  show the translated error through the shared action toast and preserve unsaved text.
  Hosts SHALL retain server authorization and an explicit site/plugin key prefix.
  Image reads, image publication and cleanup SHALL NOT issue unconfigured object requests.

#### Scenario: Editing locally without a bucket

- **WHEN** an authorized editor creates, saves and publishes an article without images and no S3 bucket is configured
- **THEN** its text and publication persist in PostgreSQL without S3 requests
- **AND** article access does not depend on object storage setup

#### Scenario: Attempting an upload without image storage

- **WHEN** an authorized editor selects an image while the S3 client or bucket is missing
- **THEN** an error toast explains that image storage is not configured
- **AND** unsaved article text remains intact and no object-ledger row is created
- **AND** unauthorized callers still receive an authorization error

### Requirement: Blog image lifecycle and transfer

Image cleanup SHALL preserve images referenced by current drafts, publications
or retained history across all languages and reprises. Article deletion SHALL
remove public visibility immediately and leave image cleanup retryable after
the grace period. Hosts transferring database image bytes to S3 SHALL preserve
article documents and image IDs, verify uploaded bytes before cutover and retain
the original data until recovery is verified.

#### Scenario: Transferring database images

- **WHEN** a host adopts the companion from a custom database image adapter
- **THEN** the transfer preserves drafts, publications, translations, image IDs and public URLs
- **AND** failed image verification prevents committing the data transfer
- **AND** retries do not overwrite different bytes or resurrect subsequently deleted articles

#### Scenario: An image survives only in history

- **WHEN** an image is absent from current drafts and live publications but referenced by a retained version
- **THEN** maintenance preserves its bytes and reference metadata
- **AND** removing that version makes the image eligible only after every remaining reference and the grace period have been checked

### Requirement: Readable storage object filenames

Drive, Blogs and employee/custom photos SHALL rebuild
`[asset_name]-[type]-[modifier].[extension]` in unique site/plugin directories.
Hyphens SHALL separate fields; underscores SHALL join words. The first upload
field SHALL supply the asset name; host context SHALL replace the type. Modifiers
except `original` SHALL remain; absent modifiers SHALL stay absent. Uploads SHALL
NOT invent transformations. Fields SHALL use safe lowercase letters, digits and
underscores.

#### Scenario: Recognizing an uploaded object

- **WHEN** an editor uploads `Annual Report.PDF` to a project Drive space
- **THEN** its staging and final object names end in `annual_report-project.pdf`
- **AND** UUID directories prevent same-name uploads from overwriting each other
- **WHEN** a blog upload called `Cover.JPG` contains validated PNG bytes
- **THEN** its object name is `cover-blog.png`

#### Scenario: Preserving an employee photo's source name

- **WHEN** an employee selects `Mia Portrait.JPG` and confirms its WebP crop
- **THEN** the photo callback receives `mia_portrait-employee.webp`
- **AND** the host validates the bytes and applies the same naming rule before storing the object
- **AND** an existing stored photo keeps its original key during later employee edits

#### Scenario: Rebuilding a structured asset name

- **WHEN** `the_corner-logo_mark-white_bg.png` is uploaded to Blogs
- **THEN** the filename becomes `the_corner-blog-white_bg.png`
- **AND** the existing type is replaced rather than appended
- **WHEN** `the_corner-logo.png` is uploaded to a `menu-item` Drive scope
- **THEN** the filename becomes `the_corner-menu_item.png` without a modifier
- **WHEN** `cover-blog-original.jpg` is uploaded again
- **THEN** its name becomes `cover-blog.jpg`

#### Scenario: Selecting the extension

- **WHEN** Drive receives a filename with a usable extension
- **THEN** it preserves that extension in lowercase, otherwise using `.bin`
- **WHEN** Blogs validates PNG, JPEG or WebP bytes
- **THEN** the object uses `.png`, `.jpg` or `.webp` respectively

### Requirement: Compatible storage filename adoption

Stored names SHALL remain immutable across renames, copies and trash/restoration.
Existing unnamed keys and pending uploads SHALL remain usable. Drive adoption
SHALL add nullable persisted storage names before deploying updated writers and
maintenance workers together. Adoption SHALL NOT rename existing objects.

#### Scenario: Preserving legacy objects and shared bytes

- **WHEN** a host adopts readable filenames with existing objects or pending uploads
- **THEN** existing keys remain authoritative for completion, reads and cleanup
- **AND** renaming or duplicating an entry preserves its original object path
- **AND** deletion retains bytes until their last reference is removed

### Requirement: Blog publication toggles

Publication badges SHALL preserve authorization, validation, version checks and
idempotency. Editor badges SHALL toggle the selected language; table badges SHALL
require `onSetPublished`. Historical returns SHALL require version-bound
confirmation. Pending or unsaved changes SHALL block toggling; failures SHALL
restore the prior status and show an error.

#### Scenario: Toggling a live translation

- **WHEN** staff activate a Published or Unpublished changes badge
- **THEN** only that translation is unpublished immediately, preserving its draft
- **AND** activating its Draft badge publishes the saved revision if valid, after historical-return confirmation when required
- **AND** the separate Publish action can publish revisions without unpublishing first
- **AND** table badges remain read-only without the host's `onSetPublished` callback

#### Scenario: A badge would discard later publications

- **WHEN** a history-enabled publication badge targets a draft resumed from an earlier publication
- **THEN** it names the versions to discard and awaits explicit confirmation
- **AND** canceling preserves the live publication and every retained state
- **AND** a direct request without required historical-return confirmation fails with `HISTORY_CONFIRMATION_REQUIRED` without mutation

### Requirement: Blog administration table

The administrative article table SHALL show the requested language's current
draft category names, falling back to an available category translation. Long
titles and category lists SHALL truncate visually while retaining the full text
for assistive technology.
Existing list adapters MAY omit category names until they refresh their source or data mapping.

#### Scenario: Scanning article categories

- **WHEN** staff view the article table
- **THEN** each article shows the requested language's current draft category assignments
- **AND** long text does not push the row actions out of the table

#### Scenario: Updating a custom list adapter

- **WHEN** an existing adapter supplies list items without category names
- **THEN** the table remains usable and shows an empty category indicator
- **AND** the host can supply names without a database migration

### Requirement: Separate blog authorship

Blogs SHALL separate authors from editors, defaulting authorship to the creator.
Public credit SHALL use the publication's author, falling back to its editor only
for unattributed legacy publications. Assignment SHALL use trusted server names.
Captured language signatures SHALL remain separate from article-wide management
authority. Optional host adapters SHALL resolve current names and retain trusted
signatures when deleting accounts.

#### Scenario: Author changes their account name

- **WHEN** an author renames their account and the host supplies current-name resolution
- **THEN** admin and public reads show the current account name across published languages
- **AND** a distinct public employee profile name does not replace it
- **AND** published text, revision, publication date and last editor remain unchanged without a draft save or republication
- **AND** clients without the optional resolver continue displaying stored signatures
- **AND** the host invalidates affected admin and public caches

#### Scenario: Keeping a departing author's articles

- **WHEN** an administrator keeps articles while removing their author's account
- **THEN** the host snapshots the last trusted name in the same authorized transaction as account removal and invalidates affected caches
- **AND** that name remains readable after deletion
- **AND** current and retained history signatures are updated without changing content versions, publication dates or saving actors
- **AND** a failed deletion transaction does not partially update signatures

### Requirement: Reviewed legacy blog attribution

Older documents without an explicit author SHALL remain readable with their recorded
attribution and editable as drafts. Publication SHALL fail until an administrator
explicitly selects and saves an eligible author. Saving other fields SHALL NOT
confirm the last editor as author or grant that editor ownership. Hosts SHALL NOT
claim to recover an unknown historical author from editing history.

#### Scenario: Republishing an older article

- **WHEN** an administrator publishes a document without a confirmed author
- **THEN** the server rejects publication and the UI requests explicit author selection
- **AND** its existing public version stays unchanged
- **WHEN** the administrator selects and saves an eligible author
- **THEN** that author or an administrator can publish the reviewed draft

### Requirement: Collaborative blog permissions

The shared policy SHALL let active staff read articles and save drafts. Only the
current author or administrator SHALL publish, unpublish, delete or reassign.
Category management and confirmation of unknown legacy authorship SHALL require
an administrator. Hosts SHALL derive eligible actors and current stored authors
on the server, repeating authorization inside the write transaction. Per-article
controls and bulk selection SHALL honor these capabilities.

#### Scenario: A colleague corrects another author's article

- **WHEN** a colleague saves a correction
- **THEN** the draft records the colleague as last editor without changing the author
- **AND** publication or author takeover is rejected unless the actor is the author or an administrator

### Requirement: Optimized blog cover images

Blog cover uploads SHALL use the shared crop dialog to prepare optimized WebP
bytes by default. Hosts MAY override output dimensions or explicitly disable
cover cropping. Inline Markdown images SHALL retain their existing proportions.
Invalid images and failed uploads SHALL preserve other edits and allow retry or
cancellation.

#### Scenario: Confirming or canceling a cover crop

- **WHEN** an editor selects a new cover image
- **THEN** the configured crop is confirmed before upload begins
- **AND** canceling preserves the previous image

#### Scenario: Blog cover upload fails

- **WHEN** image decoding or the host upload fails
- **THEN** accessible feedback supports retry or cancellation
- **AND** unrelated form values remain intact

### Requirement: Complete localized blog history

Each article language SHALL retain complete saved states containing title, slug,
summary, Markdown, designated author, thumbnail and banner references, their
alternative text, inline image references and category assignments. Version
identity, save time and saving actor SHALL be recorded separately from the
designated author. Retained states SHALL preserve their captured content; trusted
account-name resolution and departure-signature retention SHALL remain supported.

#### Scenario: Returning to a complete French state

- **WHEN** an authorized user resumes an earlier French state
- **THEN** its content, signature, illustrations and category assignments are available together
- **AND** German drafts, retained states and public content remain unchanged
- **AND** the global category taxonomy is not rolled back or recreated
- **AND** a category that no longer satisfies publication validation must be corrected before publication

#### Scenario: A colleague saved the selected version

- **WHEN** Bob saved a state whose designated author is Alice
- **THEN** the history identifies Bob as its editor and Alice as its signature
- **AND** restoring it does not credit Bob or the publisher automatically
- **AND** current account-name resolution and trusted signatures after account deletion still apply
- **AND** unknown legacy authorship still requires explicit administrator review

### Requirement: Stable blog version identity

Changed saves SHALL replace the saved draft. Unchanged saves and publication
SHALL NOT duplicate content versions. Drafts SHALL use a translated label without
a version number. Only publishing a new draft SHALL assign the next number from
the existing publication counter. Publication numbers SHALL stay stable and
increase per language; deletion or pruning SHALL NOT reuse them. Unsaved edits
SHALL remain distinguishable from saved versions.

#### Scenario: Saving and publishing one edit

- **WHEN** an editor saves changed text, author or other captured inputs
- **THEN** one new saved version is recorded
- **AND** repeating an unchanged save or retrying the same request creates no additional version
- **AND** publishing that state preserves its snapshot identity and assigns the next publication number
- **AND** changing only an account's current name does not create a content version

#### Scenario: Saving after a historical return

- **WHEN** v40 was the latest allocated publication and an earlier publication is resumed or a retained state is removed
- **THEN** subsequent changed saves remain labeled Draft and the next new publication is v41
- **AND** deleting a draft or republishing an unchanged existing publication does not consume or reset publication numbers
- **AND** optimistic concurrency versions and internal snapshot allocations remain independent of visible publication numbers

#### Scenario: Saving resumed content without another edit

- **WHEN** staff resume a publication whose captured inputs differ from the current working state and save it without further edits
- **THEN** a distinct current draft is saved even though its inputs match the historical source
- **AND** the source publication retains its original identity and content
- **AND** publishing preserves the new draft identity rather than moving the source publication into the live position

### Requirement: Independent blog history limits

Each article language SHALL retain at most five publications, including its live
publication, and one saved draft. Changed saves SHALL replace the previous draft.
Successful publication SHALL promote the current saved draft without duplication
and clear the pending draft. Only exceeding the publication limit SHALL prune the
oldest publication. Unpublishing SHALL preserve retained history without allocating
a content version. Languages SHALL retain independent limits.

#### Scenario: Saving a ninth draft

- **WHEN** staff continue editing and perform a ninth changed save in the selected language
- **THEN** only the latest saved draft remains, without a replacement warning for ordinary continuation
- **AND** publications are preserved and unchanged saves or retries create no duplicate entry

#### Scenario: Publishing a sixth publication

- **WHEN** publishing the current saved draft would retain six publications
- **THEN** publishing automatically removes the oldest publication without a retention confirmation
- **AND** success leaves five publications, makes the promoted draft live and removes its separate draft entry
- **AND** a stale request or failure preserves the previous live state, draft and publications

#### Scenario: A history contains fewer than six entries

- **WHEN** a language has fewer than five publications or no pending saved draft
- **THEN** only existing states appear, without placeholder versions or duplicate live/draft entries
- **AND** another language's states and limits remain unchanged

### Requirement: Confirmed atomic blog history publication

Publication SHALL atomically promote the current saved draft, preserve its
identity and retain publications up to the five-publication limit. Historical
content SHALL first be resumed as a draft. All clients SHALL prune excess
publications automatically. Deletion, draft replacement and missing-image omission
SHALL require confirmation. Plans SHALL be server-derived and version-bound.
Authorization, validation, concurrency, image recovery and idempotency SHALL remain enforced.

#### Scenario: Reworking v18 before publication

- **WHEN** an authorized user resumes v18 while v22, v26, v36 and live v37 are retained
- **THEN** the resumed content becomes the working draft while v37 stays live
- **AND** saving preserves all five publications and replaces only the previous draft after the required confirmation
- **WHEN** the user publishes the saved draft
- **THEN** it becomes a new live publication and v18 is removed only because it is the oldest of six publications
- **AND** v22, v26, v36 and v37 remain retained, with no additional deletion caused by the source's age

#### Scenario: A stale or failed confirmation

- **WHEN** article state changes after a missing-image plan was displayed, or authorization, validation, image checking or persistence fails
- **THEN** the prior live content, saved draft and retained history remain intact
- **AND** the UI preserves selected content and unsaved input for correction or retry
- **AND** a stale article version or plan token returns `CONFLICT` and requires a fresh plan and confirmation
- **AND** replaying a successful request does not repeat deletion or allocate another version

#### Scenario: A historical publication is submitted directly

- **WHEN** a caller attempts to activate a historical publication in place without first saving it as the current draft
- **THEN** the request is rejected without changing live content or retained states
- **AND** editor, table and transport entrypoints cannot bypass the draft-first workflow

### Requirement: Confirmed single blog draft resumption

Resuming a retained publication SHALL prepare its complete content in the single
draft without changing live content. Replacing an existing draft SHALL require
explicit confirmation naming the loss. Cancellation SHALL preserve the draft.
Reading history SHALL remain read-only. Unsaved-change, failure and concurrency
protections SHALL continue to apply.

#### Scenario: Continuing the current draft

- **WHEN** v3 is live and staff continue editing and saving the draft derived from v3
- **THEN** the latest saved content replaces that draft without a replacement warning
- **AND** v3 remains live until publication succeeds

#### Scenario: Resuming v1 while a draft from v3 exists

- **WHEN** v3 is live, a draft derived from v3 exists, and staff only inspect v1
- **THEN** no draft is replaced and the existing unsaved-change guard still protects departure from dirty work
- **WHEN** staff choose to resume v1
- **THEN** confirmation states that the current draft and its changes will be replaced
- **AND** cancel retains the current saved and unsaved work
- **AND** confirming prepares v1 as the sole working draft while v3 stays live
- **AND** the prior saved draft is replaced atomically only when the resumed content is successfully saved
- **AND** failed saves retain the prior saved draft and the resumed local input for retry

#### Scenario: Resuming with no pending draft

- **WHEN** v3 is live and staff resume either v2 or v1 with no pending draft or unsaved work
- **THEN** the selected version becomes the working draft without a false loss warning
- **AND** v3 is not moved into the draft and publications remain unchanged until Publish succeeds
- **AND** republication requires a distinct saved draft, even when the source content was not edited

#### Scenario: Another editor changes the draft after confirmation

- **WHEN** another editor saves after replacement was confirmed but before the resumed draft is saved
- **THEN** the stale save returns `CONFLICT` without overwriting that newer draft
- **AND** staff must review the refreshed state and reconfirm replacement before retrying historical resumption

### Requirement: Simplified blog history showroom

The Blogs showroom SHALL demonstrate the one-draft, five-publication workflow with
localized examples and controls matching the shipped model. Existing permission,
transport, concurrency, missing-image and failure simulations SHALL remain usable.
It SHALL demonstrate the actual comparator rather than the mockup's simplified
text display.

#### Scenario: Loading the history example

- **WHEN** a reviewer loads the history example for the open article
- **THEN** English and French each receive five publications and one draft with their own content
- **AND** the live publication counts among the five and no parallel reprise branches appear
- **AND** unrelated articles remain unchanged and no obsolete eight-draft or multi-reprise help remains

#### Scenario: Exercising replacement and preserved controls

- **WHEN** a reviewer resumes an older version while the example has a draft
- **THEN** confirmation supports cancellation and successful continuation
- **AND** repeated ordinary draft saves do not request replacement confirmation
- **AND** History transport, concurrent-correction, missing-illustration, permission and failure controls continue to exercise their intended behavior
- **AND** detailed comparison remains available for selected versions and unsaved draft content
- **AND** settings retain their existing responsive visibility, keyboard behavior and values when collapsed

#### Scenario: Choosing the Blogs interface language

- **WHEN** a reviewer opens Blogs in French, German or Italian
- **THEN** the showroom supplies complete translated plugin labels for fields, statuses, history, actions, errors, confirmations and the image-crop dialog
- **AND** English continues to use the plugin’s default labels
- **AND** admin navigation retains the interface locale even when the article’s selected translation is English or French
- **AND** changing the interface language does not create, publish or silently translate article content

### Requirement: Authorized blog history management

Active staff SHALL be able to inspect history. Only the current designated author
or an administrator SHALL resume historical states for republication or delete
history. Authorization SHALL use the current article before restoration, not the
selected historical author. Ordinary collaborative draft editing and explicit
author reassignment SHALL retain their existing policy.

#### Scenario: A historical author attempts to take control

- **WHEN** a caller owns the selected old signature but lacks current management rights
- **THEN** direct historical resumption and deletion requests are rejected
- **AND** selecting the old version does not change ownership

#### Scenario: Managing a signature and deleting a version

- **WHEN** the current author or an administrator resumes a state
- **THEN** the resumed draft retains its designated author and the existing author selector remains available
- **AND** an explicit saved reassignment changes current management rights under the existing article-wide authorship policy
- **AND** other languages' saved signatures and live publications remain unchanged
- **WHEN** an authorized user confirms deletion of a non-live retained version
- **THEN** only that version is removed, without renumbering or changing live content
- **AND** the live publication cannot be individually deleted from history
- **AND** deleting the sole saved draft returns to the live state, or an empty unsaved state if nothing is live, without resetting allocation counters or creating another saved draft

### Requirement: Blog history inspection and comparison

The editor SHALL provide chronological history in a right-side panel and
read-only inspection. A bounded unified diff against the live language publication
SHALL show context once and emphasize changed words in subtle removed/added rows.
Expensive inputs SHALL fall back to complete removed/added text. Missing live
content SHALL have an explicit comparison empty state.

#### Scenario: Reading the history list

- **WHEN** staff open the history panel
- **THEN** one chronological list shows publication numbers, a translated unnumbered draft, authors, times, states and separate publication/draft counts
- **AND** no reprise lanes appear

#### Scenario: Comparing a small text change

- **WHEN** only one word changes inside a paragraph
- **THEN** unchanged words retain subdued emphasis and the changed words have stronger removed/added backgrounds
- **AND** a pure insertion does not invent a removal or duplicate an unchanged prefix
- **AND** changed captured fields are distinguishable without relying only on color
- **AND** Markdown and diff text cannot execute supplied markup or scripts

#### Scenario: Switching reading and comparison

- **WHEN** staff inspect a saved state or compare their current draft
- **THEN** Read and Compare are both available as explicit selected modes
- **AND** comparison names both endpoints, such as v22 (live) to Draft, including the translated unsaved-draft distinction
- **AND** the reference endpoint uses the same red semantic treatment and minus marker as removed values, while the selected endpoint uses the green treatment and plus marker of added values
- **AND** switching to Read and back to Compare preserves the selection and working content
- **AND** title, slug, summary, author, categories and image differences remain included, with an explanation that unchanged fields are hidden

#### Scenario: Inspecting on a narrow screen

- **WHEN** a user opens history on mobile or uses the keyboard in either theme
- **THEN** selection, comparison, version labels and permitted actions remain usable without horizontal overflow
- **AND** leaving dirty work requests an explicit save or discard decision
- **AND** historical inspection does not mutate article content, attribution or permissions

#### Scenario: Comparing a working draft and captured fields

- **WHEN** staff compare the current draft, including unsaved edits, or a selected history version
- **THEN** the reference remains the live publication in the selected language
- **AND** the existing paragraph/word diff, whitespace handling and bounded fallback remain available
- **AND** comparison covers title, slug, summary, signature, thumbnail, banner, their alternative text, categories and Markdown
- **AND** changed metadata uses separate removed/added rows with the same semantic colors as Markdown changes, minus/plus markers and accessible removed/added descriptions
- **AND** each displayed field and the Markdown block has a visible label identifying what is compared, with the Markdown heading also naming its accessible section
- **AND** before/after images, loading and retry feedback, read previews and return to draft remain available
- **AND** comparison does not overwrite or save the working draft

### Requirement: Blog history image recovery

A missing optional historical illustration SHALL NOT prevent publication of
otherwise valid text after explicit confirmation. Preview SHALL show a missing
image placeholder; the public view SHALL omit the unavailable illustration or
leave its image area empty. Recovery SHALL preserve original historical references
and asset ownership checks. Transient provider failures SHALL remain retryable.

#### Scenario: Publishing without a lost illustration

- **WHEN** a selected historical image is confirmed missing and the user confirms publication without it
- **THEN** valid text is published without a broken public image
- **AND** the historical source keeps its original image reference
- **AND** the user can instead replace, reimport or remove the illustration in a draft
- **AND** publication does not copy S3 objects or invent replacement bytes

#### Scenario: An image cannot be verified temporarily

- **WHEN** image verification times out or storage access fails without establishing absence
- **THEN** feedback distinguishes the failure from a confirmed missing image and permits retry
- **AND** failed verification does not discard content, history or references
- **AND** inaccessible or foreign image identifiers do not bypass article ownership or authorization

### Requirement: Private and compatible blog history adoption

History and history-only images SHALL require fresh article read permission.
Public responses SHALL expose only effective live content. Article lists SHALL
exclude history bodies; history lists SHALL return bounded summaries and fetch
selected bodies on demand. Retry acknowledgements SHALL remain small.
`BlogsClient.history` SHALL be optional. Hosts SHALL own validated transport,
session checks, cache invalidation and coordinated migration.

#### Scenario: Requesting archived content publicly

- **WHEN** an unauthenticated visitor requests a historical body, its metadata or a history-only image
- **THEN** it is not disclosed through public endpoints or caches
- **AND** an authorized staff reader can inspect it without making it public

#### Scenario: Adopting existing articles

- **WHEN** a host explicitly migrates existing blog data for history support
- **THEN** it generates additive migrations from the exported Drizzle schema and stops incompatible writers
- **AND** `backfillHistory` followed by `backfillBlogProjections` runs in the reviewed migration transaction
- **AND** current drafts and live publications become retained initial states without invented older versions
- **AND** content, saved signatures, image IDs, URLs and publication metadata are preserved
- **AND** repeating migration creates no duplicate versions
- **AND** identical current draft/publication inputs share one initial history identity
- **AND** existing clients remain usable for ordinary publication without history controls, while the server rejects direct activation of a historical publication
- **AND** history-enabled hosts wire authorized `list`, `get`, `plan`, `publish` and `delete` operations while preserving their adapters
- **AND** migration-journal and Blogs readiness checks pass before traffic is served
- **AND** source installation runs no migration and does not establish deployment

#### Scenario: Rolling back history controls

- **WHEN** a host rolls back the history interface
- **THEN** it retains the additive schema, history data and compatible writers
- **AND** it does not downgrade to writers that discard localized settings or history counters

#### Scenario: Installing the simplified workflow

- **WHEN** a host installs source for the simplified history workflow
- **THEN** installation does not run a data migration, remove deployed records or alter objects
- **AND** existing schema, authorized transport and startup-readiness requirements still apply

### Requirement: Menus plugin

`@forge/menus` SHALL provide public menus and staff item/taxonomy editors. Its Menu
editor module SHALL own item and taxonomy editing, saved state and unsaved-change
protection independently of the Blog editor, preserving the existing page interfaces.

#### Scenario: Representing a menu item

- **WHEN** staff create or edit a menu item
- **THEN** it SHALL contain a default price in minor currency units, optional size prices, a category, translated name and description, visibility, sold-out state, order, optional image and reusable allergen/dietary labels

#### Scenario: Reading a public menu

- **WHEN** a visitor views a public menu in the requested locale
- **THEN** missing requested translations SHALL use the base locale for the whole entity
- **AND** the menu SHALL include only visible items
- **AND** sold-out items SHALL remain visible with a pending-colored status at the top right

#### Scenario: Leaving an unsaved menu item

- **WHEN** staff follow the Labels management or Back link with unsaved menu-item changes
- **THEN** the editor offers save, discard and cancel
- **AND** save validates all edited fields and continues only after successful persistence; failed saves retain the draft and dialog for retry
- **AND** invalid input keeps staff in the editor with field errors, while cancel preserves the draft and discard navigates without saving
- **AND** pending saves block both links and dialog dismissal; unchanged or successfully saved items navigate directly

#### Scenario: Browser history leaves an unsaved menu item

- **WHEN** a host router blocks Back or Forward navigation away from a dirty menu editor
- **THEN** the portable editor resolves the blocked transition through its existing save, discard and cancel dialog
- **AND** cancel preserves the editor, URL and draft; discard resumes the original history transition without saving
- **AND** save resumes that transition only after persistence succeeds, while invalid inputs cancel it and failed saves retain the dialog for retry
- **AND** the Menu editor owns the native browser warning while changes or saves are pending, including hosts without a router adapter; confirmed Save or Discard clears that warning before leaving
- **AND** host adapters own SPA interception without adding duplicate unload handlers or synthetic history entries
- **AND** pending saves reject new history transitions until completion; clean editor navigation and same-item folder changes retain normal history behavior

#### Scenario: Browser history leaves an open menu label editor

- **WHEN** a host router blocks Back or Forward while a category or label dialog has unsaved changes
- **THEN** the taxonomy page offers Save, Discard changes and Cancel before unmounting
- **AND** Cancel retains the open editor and its translations, position, label type and icon
- **AND** Save validates and persists before continuing; invalid fields return to the editor and storage errors retain the leave dialog for retry
- **AND** Discard resumes the original transition without saving; closed or clean editors do not prompt
- **AND** pending saves reject new route changes, and native unload warns while the open editor is dirty or pending

#### Scenario: Rejecting malformed service requests

- **WHEN** a host passes malformed request data to the server companion
- **THEN** Zod validates the input before its fields reach storage and failures use the plugin's `INVALID` error
- **AND** parsed objects exclude unknown fields while existing authorization and business rules remain enforced
- **AND** optional inputs retain their documented omission semantics

#### Scenario: Reordering menu items

- **WHEN** staff reorder items using a host-provided reorder method
- **THEN** Staff item editors SHALL omit the display-order input. The item table SHALL offer
  grip handles when the host supplies the optional reorder client method, supporting
  pointer/touch dragging and Up/Down arrow keys. Search SHALL be cleared before
  reordering, and pending saves SHALL prevent additional moves. Item order SHALL
  persist through an authorized atomic operation with complete-list and version
  checks; invalid or stale requests SHALL leave every item unchanged. Reordering
  SHALL change only positions and their versions, preserving item content and
  categories. Failures SHALL be announced and current data reloaded. Public menus
  SHALL retain category ordering and apply the saved item order within each category.
  Hosts without the optional method SHALL retain a usable table without handles.

#### Scenario: Replacing a staff menu item list client

- **WHEN** the host replaces the client supplying the staff item list
- **THEN** previous reads and writes SHALL NOT replace, refresh or report reorder feedback in the new list
- **AND** unconfirmed selections, single-delete dialogs and drag gestures SHALL reset, even when item IDs are reused
- **AND** a confirmed bulk deletion SHALL continue through its original client and retain only failed entries for retry without altering the replacement list
- **AND** loaded rows SHALL remain visible during same-client refresh and failed reads, with further writes disabled until the read succeeds

#### Scenario: Replacing a menu item editor

- **WHEN** the host changes the editor's client or item ID, including creation/edit transitions
- **THEN** the editor SHALL reset its draft, version, validation and pending state without requiring a host-supplied key
- **AND** earlier save completions SHALL NOT update the replacement editor, show feedback or call `onSaved` after replacement or unmount
- **AND** an already submitted write MAY finish on its original server

#### Scenario: Preserving the current menu item draft

- **WHEN** the same client supplies refreshed data for the same item or the user navigates photo folders
- **THEN** the editor SHALL preserve the local draft and its version rather than silently rebasing edits
- **AND** fields SHALL remain editable while a save submits a snapshot, with duplicate submissions disabled
- **AND** success SHALL advance only the accepted version without overwriting later edits; failure SHALL retain the draft and version for retry
- **AND** existing server version checks SHALL continue to reject conflicting writes

#### Scenario: Filtering visible dishes

- **WHEN** a visitor filters a supplied public menu
- **THEN** Public menus SHALL offer allergen exclusion and dietary filters only for labels
  assigned to at least one supplied visible item. The complete translated default
  catalog SHALL remain available to staff in taxonomy and item editors. Labels used
  only by hidden items or not assigned to an item SHALL NOT appear as public filter
  choices. Supplied overrides SHALL NOT introduce unused public choices. A dish SHALL be excluded when it carries
  any selected allergen and SHALL match every selected dietary label. Both groups
  SHALL combine, matching dishes SHALL retain their ordering and sold-out status,
  and categories without matching dishes SHALL be omitted. Choices SHALL remain
  available after filtering. Controls SHALL support keyboard use, host-translated
  labels and both themes; results SHALL be announced with a count or empty message.
  Clearing filters SHALL restore all supplied dishes. New filter label overrides
  SHALL be optional, and the unfiltered menu SHALL remain visible during SSR.

#### Scenario: Navigating menu categories

- **WHEN** a visitor selects or scrolls between menu categories
- **THEN** Public menus SHALL provide sticky category navigation using the supplied category
  names and order. Selecting a category SHALL scroll to its section without hiding
  other matching sections. The current section SHALL be highlighted while scrolling.
  The row SHALL scroll horizontally on narrow screens, support keyboard navigation,
  use host semantic colors and omit categories without matching dishes. Hosts SHALL
  be able to account for a fixed header without editing distributed source.

#### Scenario: Presenting labels and their catalog

- **WHEN** staff or visitors view dish labels and filter choices
- **THEN** Public menus SHALL show ingredient/diet icons and semantic status badges on
  assigned dish labels and filter choices. Vegetarian and Vegan SHALL use success
  green, Gluten SHALL use pending orange, and Milk SHALL use informational blue.
  Visible text SHALL remain and selected filters SHALL retain clear checkbox and
  focus states. Colors SHALL identify labels rather than allergy reaction severity.
  The default catalog SHALL cover the 14 standard allergen groups and common dietary
  options with English, French, German and Italian names. Existing host label IDs
  and custom labels SHALL remain usable. Public allergen and dietary choices SHALL
  sort alphabetically by their displayed names using the current locale, ignoring
  case and accent differences. Custom labels and supplied overrides SHALL follow
  the same alphabetical order rather than their supplied or catalog positions.
  The catalog SHALL NOT infer dish ingredients or dietary claims.

#### Scenario: Refreshing menu categories and labels after a write

- **WHEN** a category or label save or deletion succeeds
- **THEN** one taxonomy lifecycle accepts the canonical result and refreshes both collections
- **AND** loaded rows remain visible and further writes wait for refresh to settle
- **AND** failed reads retain accepted rows with retry, while failed writes retain dialog drafts and confirmations
- **AND** responses from an earlier client session cannot change or refresh the current client's taxonomy

#### Scenario: Editing label icons

- **WHEN** staff create or edit a menu label icon
- **THEN** Staff label lists SHALL display a decorative icon before each name. New and edit
  label dialogs SHALL offer a translated icon selector with a live preview. Saved
  choices SHALL appear consistently in the taxonomy, item editor, public dishes
  and filters without changing badge colors. Automatic SHALL restore the recognized
  preset or generic icon. Failed saves SHALL retain the selected icon for retry.
  The optional label icon SHALL accept only the exported catalog of icon names.
  The storage companion SHALL validate and persist icons; omitted icons on edits
  SHALL preserve the saved choice and explicit null SHALL restore automatic icons.
  An idempotent incremental migration SHALL add a nullable icon column, preserving
  existing labels and saved overrides. Installing source SHALL NOT apply it.

#### Scenario: Choosing default dietary labels

- **WHEN** a host uses or overrides the default dietary catalog
- **THEN** The default dietary catalog SHALL omit gluten-free, dairy-free, lactose-free,
  egg-free, tree-nut-free, peanut-free, soy-free and sesame-free choices to avoid
  repeating the allergen exclusion controls. Distinct dietary choices and supplied
  custom labels SHALL remain available.
  The default dietary catalog SHALL focus on common restaurant choices and omit
  specialized nutrition labels such as Low carb, Keto and Sugar-free, as well as
  Alcohol-free. Hosts SHALL retain the ability to supply those labels explicitly.

#### Scenario: Displaying dish heat

- **WHEN** staff assign a dish spice level or a visitor views that dish
- **THEN** Spiciness SHALL be dish information, independent of dietary labels and filters.
  Spicy SHALL NOT appear in the default dietary catalog. Hosts SHALL be able to
  assign spice levels zero through three in the staff editor and clear a level.
  Public dishes with levels one, two or three SHALL show that number of decorative
  flame icons and visible translated heat text; zero SHALL show no heat badge.
  The default UI text SHALL be English and hosts SHALL be able to override it.

#### Scenario: Persisting dish spice levels

- **WHEN** a host writes or upgrades stored spice levels
- **THEN** The storage companion SHALL persist spice levels and return them with public
  menus. Invalid levels SHALL be rejected by service validation and the database.
  Existing dishes and new items without a supplied level SHALL default to zero.
  Older clients omitting the field during edits SHALL preserve the saved level.
  The storage upgrade SHALL use an incremental, idempotent migration that preserves
  existing data. Installing source SHALL NOT apply migrations, infer heat from
  legacy labels or rewrite host taxonomy.
  Installing source SHALL NOT seed production data automatically.

#### Scenario: Editing and selecting item sizes

- **WHEN** staff configure sizes or a visitor chooses a size
- **THEN** Items SHALL support an optional ordered list of sizes, each with a stable ID,
  translated name and its own minor-unit price. The first size SHALL be the default
  selection and saved default item price. Empty or absent sizes SHALL retain the
  single-price display. The staff editor SHALL support adding, translating, pricing
  and removing sizes, require base-language names and retain drafts on save failure.
  Public menus SHALL show every size and price, support keyboard selection, update
  and announce the selected price, wrap on narrow screens and use host semantic
  colors and translated UI labels. Missing size translations SHALL fall back
  individually to the base locale. Size selection SHALL NOT create orders.

#### Scenario: Persisting and upgrading item sizes

- **WHEN** a host saves size data or upgrades existing items
- **THEN** The storage companion SHALL persist sizes and return localized size prices in
  public menus. Invalid prices, duplicate or empty size IDs, missing base names
  and lists above 20 sizes SHALL be rejected. New items without sizes SHALL default
  to an empty list. Older clients omitting sizes during an edit SHALL preserve the
  saved sizes and their default price; explicit empty lists SHALL clear sizes.
  A separate idempotent incremental migration SHALL add the sizes column without
  losing existing data or resetting saved sizes. Source installation SHALL NOT
  apply database migrations.

#### Scenario: Connecting menu persistence and host configuration

- **WHEN** a host installs the Menus server companion
- **THEN** `@forge/menus-storage` SHALL provide `createMenusService`, Drizzle tables for the
  host-composed schema, using Drive storage for images. Menus business models
  SHALL NOT be registered in Better Auth.
  The host SHALL configure sessions, currency, locales and image routes. Menus
  SHALL NOT provide ordering, payment or checkout. Hidden/visible and unavailable/
  available indicators SHALL use not-started/success and pending/success pairs.

#### Scenario: Moving a menu item

- **WHEN** staff drag an item handle to another row or use Up/Down on its focused handle
- **THEN** the full order saves atomically and survives later reads and server restart
- **AND** the item editor has no display-order input, item content stays intact, and public dishes follow the saved order within their categories

#### Scenario: A conflicting or failed reorder

- **WHEN** an item changed, was added or removed since the table loaded, or storage fails
- **THEN** the entire reorder is rejected without partial position updates
- **AND** the table announces the failure and reloads current items

#### Scenario: Publishing a menu item

- **WHEN** staff make a translated menu item visible
- **THEN** its public name, price, labels and configured image can be rendered
- **AND** marking it sold out keeps it listed with a visible availability status

#### Scenario: Combining allergen and dietary filters

- **WHEN** a guest selects multiple allergens and dietary labels
- **THEN** only dishes without any selected allergen and with every selected dietary label remain
- **AND** matching sold-out dishes retain their status, empty categories disappear, and filter choices remain available

#### Scenario: Empty results and reset

- **WHEN** no dish matches the selected filters
- **THEN** the public menu announces a translated empty result message
- **AND** the guest can clear filters to restore all supplied dishes

#### Scenario: Reusing translated filters

- **WHEN** a host supplies translated dish labels and optional filter UI labels
- **THEN** filter matching uses stable label IDs and the controls show the host labels
- **AND** keyboard interaction and narrow layouts remain usable in both themes

#### Scenario: Navigating a restaurant's categories

- **WHEN** a guest selects a supplied category such as Starters, Tapas or Vegetarian dishes
- **THEN** the page scrolls to its section and keeps the other matching sections rendered
- **AND** the navigation highlights the current section and stays usable on narrow screens in both themes

#### Scenario: Filtering navigation categories

- **WHEN** filters leave a category without matching dishes
- **THEN** its section and navigation link are omitted together
- **AND** clearing filters restores both in their original order

#### Scenario: Changing a label icon

- **WHEN** staff choose and save an icon in the label editor
- **THEN** the label list, item choices, public dishes and filters show it before the name
- **AND** the saved icon survives later reads and server restart; choosing Automatic restores the preset or generic icon

#### Scenario: Scanning menu labels

- **WHEN** a guest views Milk, Gluten or Vegetarian on a dish or in the filters
- **THEN** each label has a recognizable decorative icon and a readable blue, orange or green badge respectively
- **AND** checkbox selection remains distinguishable from the label color in both themes

#### Scenario: Using the default filter catalog

- **WHEN** a host renders a menu
- **THEN** only labels assigned to supplied visible items appear as public allergen and dietary choices
- **AND** choices stay available when guest filters hide dishes and unused overrides do not add public choices

#### Scenario: Keeping the staff catalog

- **WHEN** staff edit an item or its label taxonomy
- **THEN** the complete host catalog remains available, including labels unused by public dishes
- **AND** saving a label on a visible item makes its public filter available while removing its final visible assignment removes that choice

#### Scenario: Keeping existing host labels

- **WHEN** a supplied dish uses a custom ID for a recognized translated label
- **THEN** its filter uses the assigned host ID and replaces its matching default choice
- **AND** custom labels remain visible and no extra label is assigned to the dish

#### Scenario: Simplified default dietary choices

- **WHEN** a host uses the default catalog
- **THEN** the dietary choices omit the eight free-from variants already represented by allergen exclusion
- **AND** the allergen controls and distinct dietary options remain available

#### Scenario: Common restaurant filter defaults

- **WHEN** a host uses the default menu catalog
- **THEN** Low carb, Keto, Sugar-free and Alcohol-free do not appear as default choices
- **AND** common dietary choices, allergen exclusions and supplied custom labels remain available

#### Scenario: Saving dish heat independently

- **WHEN** staff select a dish's heat level and save it
- **THEN** the stored value survives navigation and database restart
- **AND** its public badge has one, two or three flames while dietary matching stays independent

#### Scenario: Clearing or omitting heat

- **WHEN** staff explicitly save zero
- **THEN** the public dish has no heat badge
- **AND** an older client omitting the field preserves the previous saved level

#### Scenario: Upgrading existing menus

- **WHEN** a host applies the incremental spice-level migration
- **THEN** existing dishes receive a zero default without losing data
- **AND** reapplying the migration retains saved heat values and invalid levels are rejected

#### Scenario: Selecting a pizza size

- **WHEN** a guest selects a supplied size such as 30 cm or 40 cm
- **THEN** the menu shows that size's price and announces the change
- **AND** all size prices remain visible and keyboard selection works on narrow screens in both themes

#### Scenario: Editing translated size prices

- **WHEN** staff save sizes with base-language names and individual prices
- **THEN** those sizes persist and appear with the requested names or per-size base-locale fallbacks
- **AND** the first size supplies the default item price, while save failures retain the draft

#### Scenario: Preserving or clearing sizes

- **WHEN** an older client omits sizes during an edit
- **THEN** the saved sizes and default price remain unchanged
- **AND** explicitly saving an empty list restores the single-price behavior

#### Scenario: Upgrading size storage

- **WHEN** a host applies the incremental sizes migration to an existing menu
- **THEN** existing items retain their single prices and receive empty size lists
- **AND** reapplying the migration preserves saved sizes and saved options survive database restart

#### Scenario: Alphabetical filter choices

- **WHEN** a guest views allergen or dietary choices in the current language
- **THEN** each group sorts alphabetically by displayed names with locale-aware comparison
- **AND** accented names, custom labels and supplied overrides follow that order while label IDs, dish order and category navigation remain unchanged

### Requirement: Menu printing

`@forge/menus` SHALL provide an SSR-compatible staff preview and browser printing
for the current visible menu on A4 portrait or A5 landscape paper. Hosts SHALL supply data,
branding, locale, currency, labels and authorized routes. Title and footer edits
SHALL last only for the current session. Printing SHALL NOT mutate catalog data,
save menu records or require storage changes.

#### Scenario: Print the current menu

- **WHEN** staff open the print preview
- **THEN** all visible dishes retain their category and item order, descriptions, all size prices, assigned allergen and dietary labels, spice information and sold-out text
- **AND** hidden dishes, empty categories, dish photos and guest filters are absent
- **AND** existing locale fallback and minor-unit currency behavior apply

#### Scenario: Select paper and print

- **WHEN** staff select A5, edit the title or optional footer and choose Print
- **THEN** the browser receives an isolated A5 landscape document containing the preview content and host branding
- **AND** navigation, staff controls and the host shell are absent
- **AND** the browser dialog supports printing or PDF saving, with natural pagination and no booklet imposition
- **AND** dishes and headings stay together where they fit, allowing an oversized dish to split without clipping

#### Scenario: Reopen or resize the preview

- **WHEN** staff reopen the page
- **THEN** it restores A4 and the supplied title/footer defaults without reading or writing saved presets
- **WHEN** staff use a narrow screen or dark theme
- **THEN** controls remain usable and the paper uses the host's light theme

#### Scenario: Empty menu or failed preparation

- **WHEN** there are no visible dishes
- **THEN** the preview explains the empty state and disables printing
- **WHEN** a required stylesheet, font or supplied logo cannot be prepared
- **THEN** printing reports an error, keeps the entered settings and permits retry
- **AND** successful preparation waits for styles, fonts and the optional logo before opening the dialog

#### Scenario: Untrusted text and repeated attempts

- **WHEN** staff enter markup in the title or footer
- **THEN** the document renders that input as text without executing it
- **WHEN** staff cancel, print again or leave the page
- **THEN** temporary print documents are removed without changing catalog data

#### Scenario: Install in an existing host

- **WHEN** a host updates Menus without supplying the optional print destination
- **THEN** its existing staff and public menu pages continue to work
- **AND** enabling printing requires the host to wire its own guarded route, branding, semantic theme and translated labels
- **AND** direct PDF generation, stored presets and a custom layout editor are not installed

### Requirement: Menu item drag feedback

Dragging a menu item SHALL preview its name, category and insertion edge while
retaining the saved row order. Dropping SHALL immediately apply the previewed
order, save it and revert on rejection. Canceling a drag SHALL clear its feedback
without saving. Keyboard reordering, search and pending controls SHALL remain
available. Feedback SHALL support mouse, touch, both themes and narrow screens.

#### Scenario: Previewing an insertion

- **WHEN** staff drag an item over the top or bottom half of another row
- **THEN** a floating item preview, distinguished source row and insertion line show the proposed move
- **AND** the preview does not intercept pointer hit testing or add duplicate accessible controls
- **AND** dropping immediately moves the item to that position without changing its category
- **AND** rejection restores the saved order and displays the error

#### Scenario: Canceling a previewed move

- **WHEN** staff press Escape, the pointer is canceled, or they drop on the source or outside the table
- **THEN** the drag preview and insertion line disappear
- **AND** no reorder is saved and the original row order remains

### Requirement: Reservations plugin

`@forge/reservations` SHALL provide public booking, private guest management,
staff year/month/week/day calendars, a paginated all-date list, a dedicated staff
creation page and settings. Appointment creation SHALL support optional month
availability batching for guest and staff clients, retaining daily fallback for
existing host adapters and separate selected-day slot reads.

#### Scenario: Using the configured booking mode

- **WHEN** guests or staff use a Reservations installation
- **THEN** A host installation SHALL
  choose appointments or stays. Services define policies, resources supply capacity,
  and reservations occupy one resource for the full buffered interval. Stays SHALL
  use arrival/departure dates, allowed arrival times, configured checkout and local
  night counts. Selecting a date before arrival while editing departure SHALL switch
  to arrival selection and preserve departure. Appointments SHALL use fixed duration
  and working hours.
  Staff calendars SHALL support host-controlled resource, service and status filters.
  List SHALL be the initial staff view on desktop and mobile. Month SHALL reuse the
  public date picker with reservation counts and a selected-date list.
  The all-date List SHALL replace Agenda with shared pagination and authenticated, bounded server reads.
  The showroom SHALL persist non-default filters, view, date and list page in the URL and remove defaults.

#### Scenario: Integrating reservation persistence

- **WHEN** a host installs the Reservations server companion
- **THEN** `@forge/reservations-storage` SHALL provide `createReservationsService` with
  PostgreSQL persistence, transactional conflict checks, idempotency, version checks,
  private management links and durable notification jobs. Its server exports SHALL include
  `deriveManagementSecret` for deriving a reservation key from an existing host secret
  without an additional environment variable. The host SHALL own email
  delivery, transport and staff authorization. The detailed
  [Reservations contract](../reservations/spec.md) SHALL remain authoritative for
  scheduling, policy snapshots, closures, cancellation, approval and mode compatibility.
  Payments, pricing, guest capacity, recurring bookings and clinical records are
  outside the plugin's current contract.

#### Scenario: Booking a stay

- **WHEN** a guest selects an arrival time and departure date in a stay installation
- **THEN** the server derives checkout and reserves one eligible resource for the entire buffered stay
- **AND** receipts, management and staff details show the same status and endpoints

### Requirement: Mailing service plugin

`@forge/mailing` SHALL provide a reusable React Email JSX template and an
asynchronous renderer returning HTML and matching plain text. Its registry item
SHALL declare React Email. Hosts SHALL own branding, copy, recipients and URLs.
Mailing SHALL NOT add campaigns, subscribers, routes, credentials, migrations
or a queue. Installation SHALL NOT send mail.

#### Scenario: A host renders translated reservation mail

- **WHEN** the host supplies its brand, translated copy and calendar URL
- **THEN** HTML and plain text contain the same reservation details and destination
- **AND** the caller awaits rendering before sending the message

### Requirement: Safe mailing content

Mailing SHALL escape text and reject link or image URLs unless they are absolute
HTTP(S) URLs without credentials. Templates SHALL include preview text, a readable
heading, optional details and a clear action. They SHALL remain usable at narrow
widths without an external stylesheet or downloaded font.

#### Scenario: Untrusted text and unsafe destinations

- **WHEN** a guest name contains markup
- **THEN** the email displays it as text
- **WHEN** an action or image uses an unsafe scheme or relative URL
- **THEN** rendering fails before delivery

### Requirement: Separate mailing transport

The renderer SHALL NOT import server transport. A separate server entrypoint
SHALL accept host credentials, forward a stable notification ID for provider
idempotency, bound request duration and reject failed delivery. The caller SHALL
retain retry policy, authorization and safe public error handling.

#### Scenario: Delivery fails and is retried

- **WHEN** the provider fails or times out
- **THEN** the caller receives failure and retains its retry policy
- **AND** retrying the notification preserves its provider idempotency key

### Requirement: Mailing integration compatibility

Reservations' server companion SHALL declare Mailing for default notification
HTML/text. It SHALL await rendering and synchronous or asynchronous host formatters
before delivery. Rendering failures SHALL follow its existing retry policy.
Authentication hosts MAY use Mailing without changing token or account-enumeration
policy. Subject/text-only formatters SHALL remain supported without default HTML.

#### Scenario: An existing formatter supplies only plain text

- **WHEN** a reservation host returns subject and text without HTML
- **THEN** the old callback remains valid and no default HTML overrides its content

#### Scenario: Asynchronous formatting fails

- **WHEN** a host formatter rejects its promise
- **THEN** no message is sent and the notification remains retryable
- **AND** a successful retry keeps the original notification ID

### Requirement: Maintain plugin documentation

Adding or materially changing a plugin SHALL update this capability's definition
or module requirement, its registry integration guide, manifest and showroom as
applicable. Guides SHALL identify exports, dependencies, optional companions,
authorization, migrations, host responsibilities and exclusions. Exact file lists
and dependency versions SHALL remain owned by the registry manifest and package
files rather than copied into this spec.

#### Scenario: Adding a new plugin

- **WHEN** Forge introduces another optional application feature
- **THEN** this spec explains its purpose and observable capabilities
- **AND** readers can find its guide and showroom entry from the registry

### Requirement: Plugin table selection and bulk deletion

Deletable plugin record tables SHALL provide row checkboxes, mixed-state select-all
and a confirmed bulk delete action for eligible rows on the current filtered page.
Selection SHALL clear on scope changes. Existing host callbacks, authorization,
preview checks and deletion restrictions SHALL remain authoritative. Failed rows
SHALL remain available for explicit retry without resubmitting successes.

#### Scenario: Select rows in a plugin table

- **WHEN** a user selects some, all or none of the eligible rows
- **THEN** the header checkbox exposes mixed, checked or unchecked state
- **AND** a translated, tooltip-backed delete action stays visible and is disabled with neutral pagination colors for an empty selection
- **AND** keyboard use and desktop/mobile layouts work in light and dark themes

#### Scenario: Confirm a batch and recover from rejection

- **WHEN** deletion is confirmed in Customers, Projects, Employees, Blogs or Menus
- **THEN** existing callbacks run once per selected record and pending controls prevent duplicates
- **AND** rows disappear optimistically and reappear on rejection
- **AND** confirmation retains only failed names and stable Blog request IDs for retry
- **AND** employee self-deletion and Menu linked-file restrictions still apply

#### Scenario: Delete Drive entries

- **WHEN** selected file or trash entries are submitted for deletion
- **THEN** server previews and tokens are obtained for every entry before confirmation
- **AND** failed preparation blocks deletion and offers retry
- **AND** partial failure refreshes previews before another explicit confirmation
- **AND** trash, permanent deletion and Undo retain their existing behavior

#### Scenario: Move between result scopes

- **WHEN** the filter, page, folder or resource changes
- **THEN** the new scope starts without selected rows and unavailable rows are pruned
- **AND** an unconfirmed deletion session is canceled, including any preview still loading
- **AND** a late preview cannot restore confirmation or replace a newer session's Drive tokens
- **AND** a previously confirmed batch may finish across an automatic host page reset
- **AND** failures after that reset remain retryable using the original callback context and request IDs
- **AND** unmounting the control stops later calls while server authorization guards each operation
- **AND** tables without a row deletion operation do not gain a bulk action

### Requirement: Typed plugin persistence

Persistent plugins SHALL use schema-backed Drizzle queries and inferred database
types. Transaction callbacks SHALL accept typed host queries. Shared lock rows
SHALL be inserted if absent, locked for update in the transaction and retained.
Drive traversal and subtree mutations SHALL be batched under their existing scope lock. Menus image writes
and Drive mutations SHALL share the same scope lock.

#### Scenario: Competing mutations

- **WHEN** two writers target the same existing lock scope
- **THEN** only one transaction holds its row lock at a time
- **AND** rollback releases the lock without deleting its durable row
- **AND** folder checks, publication conflicts, booking collisions and notification leases retain their guarantees

#### Scenario: Adopting row locks

- **WHEN** a host upgrades from advisory locks
- **THEN** it stops old writers and workers before backfilling and validating the new schema
- **AND** it never runs advisory-lock writers concurrently with row-lock writers

#### Scenario: Mutating a wide Drive folder

- **WHEN** a subtree spans multiple database batches
- **THEN** traversal and trash/delete predicates remain bounded under the same scope lock
- **AND** any failed mutation batch rolls back the complete state change while preserving preview and deletion guards

### Requirement: Queryable blog projections

Blogs SHALL retain document and history payloads while maintaining typed search,
slug, publication, author, category and retained-image representations atomically.
Public filtering, counts, ordering and pagination SHALL remain database queries.
Backfills SHALL preserve IDs, content, publication dates and object keys and be
safe to repeat with writers stopped.

#### Scenario: Publishing and retrying

- **WHEN** an article publication commits, fails or is retried
- **THEN** its document, history and queryable representations agree
- **AND** retained history images remain protected and public listings expose only publications

### Requirement: Customer identity and profile transactions

`@forge/customers-storage` SHALL export schema and service factories using the
host's actual Better Auth user table. A one-to-one profile SHALL distinguish
customers using existing admin/user roles. Identity mutations and profile writes
SHALL share a host-supplied transaction-bound Better Auth adapter. Invitations
SHALL be delivered after commit; delivery failure SHALL leave a retryable account.

#### Scenario: Creating an account-backed customer

- **WHEN** an authorized host creates a customer with a valid unused email
- **THEN** the identity and profile commit together without an assigned password
- **AND** the host issues an expiring single-use invitation after commit
- **AND** duplicate emails fail without attaching an existing account

#### Scenario: Rolling back customer changes

- **WHEN** a profile write or transaction fails
- **THEN** identity writes and auth hooks roll back with it
- **AND** creation sends no invitation and leaves no orphan identity

#### Scenario: A customer shares an auth role with employees

- **WHEN** an employee adapter encounters an account with a customer profile
- **THEN** it excludes that account before employee counts and pagination and rejects it as an employee actor or mutation target
- **AND** host route guards distinguish customer membership from employee access using the existing admin/user roles

#### Scenario: Recovering a lost invitation response

- **WHEN** creation commits but delivery fails or the process stops before sending the invitation
- **THEN** the customer remains discoverable by email and an administrator can explicitly resend
- **AND** retrying creation rejects the duplicate email; guaranteed eventual delivery requires a host-owned outbox

#### Scenario: Editing contact fields with an outstanding invitation

- **WHEN** only company, phone or address fields change
- **THEN** the identity and invitation token remain unchanged
- **AND** actual identity changes continue through Better Auth and its security hooks

### Requirement: Customer-owned project persistence

`@forge/projects-storage` SHALL export schema and service factories for name,
status, description and a required customer relationship. Hosts SHALL authorize
ownership. Edits SHALL preserve ownership and host metadata. Foreign keys SHALL
restrict customer and account deletion while projects remain. Routing,
impersonation, invitations and external integrations SHALL remain host-owned.

#### Scenario: Editing a customer's project

- **WHEN** an authorized actor submits the shared form
- **THEN** only name, status and description change
- **AND** supplied ownership and host metadata cannot overwrite persisted values

#### Scenario: Removing a customer with projects

- **WHEN** a host attempts customer or account deletion while projects refer to it
- **THEN** the database rejects deletion and the transaction preserves the account and profile

### Requirement: Blog startup readiness

Blog services and cleanup workers SHALL await an automated startup check of the
required schema and all article/history projections. Missing or stale projections
SHALL block operations without repairing data or deleting objects. Successful
readiness MAY be cached per process after old writers have stopped.

#### Scenario: Starting before backfill completes

- **WHEN** a host starts blog reads or cleanup with missing tables, stale projections or missing retained-image references
- **THEN** startup validation fails and operations remain blocked
- **AND** a reviewed backfill followed by a successful retry allows a fresh service to start

#### Scenario: Checking readiness safely

- **WHEN** the readiness check scans existing content
- **THEN** it uses bounded reads under the shared Blogs lock without changing document/history payloads
- **AND** it does not replace the requirement to stop old writers and workers

### Requirement: Bounded customer and project directories

Customer and project storage lists SHALL accept validated search, page-size and
cursor inputs and return bounded pages. Each returned record SHALL pass host
authorization. The services SHALL NOT scan every record to fill an authorized page
or expose an unfiltered total. Host adapters SHALL preserve URL-owned page state.

#### Scenario: Paging through restricted records

- **WHEN** a page contains candidates the actor cannot read
- **THEN** the result excludes those candidates and bounds authorization checks to that page
- **AND** an empty page may retain a next cursor so the host can continue without loading the whole directory

#### Scenario: Invalid or changed page context

- **WHEN** the host receives an invalid cursor or page size
- **THEN** the service rejects it without performing an unbounded query
- **AND** the host resets paging when search, ownership scope or mutations change the result set

### Requirement: Dialog close controls

Every plugin dialog SHALL display an X close control at the top right, with a
translated accessible name, matching icon tooltip, visible keyboard focus and a
usable mobile target. It SHALL follow existing dismissal and pending guards.

#### Scenario: Dismissing a dialog on a narrow screen

- **WHEN** a user opens a form, confirmation or informational dialog
- **THEN** its close icon is visible beside the title without overlap
- **AND** activating it uses the same safe dismissal as the existing cancel action
- **AND** operations that already prevent dismissal also disable the close icon

#### Scenario: Scrolling a long dialog

- **WHEN** dialog content exceeds the available viewport height
- **THEN** the title and close control remain visible at the top and bottom actions remain visible at the bottom
- **AND** bottom actions are fully visible before scrolling even when preceding content fills a short viewport
- **AND** scrolling content stays behind opaque header and action surfaces
- **AND** fields remain reachable with keyboard and pointer input, actions wrap on narrow screens, and existing submit and pending behavior is preserved
