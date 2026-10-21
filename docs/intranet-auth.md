# Auth and employees

Install the source modules with the configured `@forge` namespace:

```sh
pnpm exec shadcn add @forge/auth @forge/employees @forge/employees-server
```

`auth` ships `LoginForm`, `AuthLayout`, `ForgotPasswordForm`, `ResetPasswordForm`,
`ChangePasswordForm`, `ChangePasswordPage`, and `AccessDeniedPage` under
`components/plugins/auth`. Its entrypoint also exports sign-in and sign-out
controls, credential types, and label types. Existing hosts using `@forge/login`
must update their imports to `components/plugins/auth` when installing this item.
`employees` ships `EmployeesPage`, `EmployeeCreateDialog`, action dialogs, labels,
and validation under `components/plugins/employees`. `employees-server` adds
`server/employees.server.ts`. The browser exports never import that server module.

The showroom lists one `/en/login` example with links to sign-in, password recovery,
account/security (`/en/account`), and access-denied states. Change passwords in the
account's Security tab or request a recovery email through “Forgot password?” on
sign-in. The standalone `/change-password` showroom route has been removed.
`/en/employees` previews employee management.
These examples use in-memory callbacks, never retain passwords, and do not create
sessions or send messages.

## Host integration

The host owns localized routes, dictionaries, branding, Query caches, auth
configuration, database migrations, and email transport. Keep those adapters
outside the installed module directories so updates do not overwrite them.
All visible labels have English defaults and accept translated overrides.
The link shim can be replaced by the host or passed through `linkComponent`.

`AuthLayout` accepts `siteName`, `logoSrc`, `homeHref`, `privacyHref`, and an
optional `languageControl`. Its footer displays the official Corner `c` logo to
the left of `Forged by The Corner Factory SA`, matching the public footer. The
decorative logo uses the same public SVG and is inverted in dark mode.
On desktop, its left panel is narrower than the form side and keeps its own
viewport-height minimum. Longer auth content can extend the right side without
stretching the left panel or pushing its copy to the bottom. The dark backdrop
continues below the left panel when the form side is taller.

`LoginForm.onSignIn` receives `{ email, password, rememberMe }`. Remember me is
checked by default; users can uncheck it before signing in. Reject its
promise when authentication fails; resolve only after successful authentication
and the host's cache refresh/navigation. The form handles pending state,
password visibility, duplicate submission prevention, and generic failure copy.
Supply `onGoogleSignIn(): Promise<void>` to show Google, the only social provider.
Omit it when Google is not configured. The host performs OAuth and supplies a
trusted callback URL. Credentials stay in the form and callback,
not browser storage. `forgotPasswordHref` links to the host's recovery flow.

## Returning from email verification

`LoginForm` accepts `defaultEmail` and `verificationStatus` (`"success"` or
`"error"`). A successful result shows the shared dismissible toast once per
mount. An error shows recovery guidance beside the form without a success toast.
Override `emailVerified` and `verificationError` through `labels`; a persistent
`ActionToastProvider` supplies the translated dismissal label. The email stays
editable, and ordinary rerenders preserve the user's draft. Key the form by the
recipient when navigating between verification links in the same mounted route.

In the host's Better Auth `sendVerificationEmail` delivery callback, retain the
issued verification URL and token but set its `callbackURL` to the configured
site origin's localized login route. Add the recipient's email and a success
marker with `URL.searchParams`, including when the original callback is absent
or `/`. Do this before rendering both HTML and plain text. Keep password-reset
links on their existing recovery route.

Validate login search values, pass the email as `defaultEmail`, and map the
success marker to `verificationStatus="success"` only when Better Auth has not
returned an `error`. Any verification error takes precedence and maps to
`"error"`. These search values control presentation only; they never grant a
session or mark an account verified. The authentication provider still validates
the token and owns the account's verification state. Old emails retain their
original callbacks; send a new verification email to use this return flow.

## Shared authentication controls

`@forge/auth` ships `GoogleSignInButton`, `SignOutButton`, `AuthControlProps`,
and `useAuthAction`. The intranet sidebar installs `auth` as a dependency.
The module does not install an auth library.

Both buttons are controlled and accept native button props, `pending`, `label`,
`pendingLabel`, and `className`. Pair them with `useAuthAction` so buttons and
menus use the same duplicate-action guard and retry behavior. Display `failed`
in an accessible alert beside the control. Success keeps controls disabled
until navigation or unmount; resolve the callback only after the host finishes.

```tsx
const action = useAuthAction();
return (
  <>
    <SignOutButton
      pending={action.pending}
      disabled={action.disabled}
      onClick={() => void action.run(onSignOut)}
    />
    {action.failed && <p role="alert">Could not sign out. Please try again.</p>}
  </>
);
```

The login form shares this guard between password and Google sign-in. Reject a
failed OAuth request so the form restores its controls and retains credentials.
Google uses `continueGoogle`, `connectingGoogle`, and `googleError` labels.

When updating, replace `socialProviders` with `onGoogleSignIn`. Provider icons
and labels no longer belong to each host. Install `auth` and `intranet-sidebar`
together, then adapt the template's registry imports. Existing sidebar
`onSignOut` and label props remain unchanged.
Keep session invalidation in the host and clear private caches only after the
authentication server confirms sign-out.

## Password recovery and changes

Place the recovery forms inside `AuthLayout` or the host's authentication layout.
Embed `ChangePasswordForm` directly in the account's security section.
`ChangePasswordPage` remains exported for existing host integrations; the showroom
does not provide a separate password-change page.
`AccessDeniedPage` is a standalone page with `homeHref`.
It displays a permission message; the host still guards the route and server.

`ChangePasswordPage` uses the same open layout, left-aligned heading and full-width
submit button as `ResetPasswordForm`. The embedded `ChangePasswordForm` keeps its
compact submit button for account security sections.

| Component                                   | Host callback and state                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ForgotPasswordForm`                        | `onRequestReset(email): Promise<void>`, optional `enabled`, `loginHref`                                                  |
| `ResetPasswordForm`                         | `onResetPassword(newPassword): Promise<void>`, required `validLink`, optional `enabled`, `loginHref`, `requestResetHref` |
| `ChangePasswordForm` / `ChangePasswordPage` | `onChangePassword({ currentPassword, newPassword }): Promise<void>`                                                      |

Reject callbacks on failure. The components display translated generic errors,
prevent concurrent submissions, preserve values after failures and ordinary
rerenders, and clear credentials on success. The reset form disappears after
success. The change form remains available with empty fields and a status message.
Password forms default to 8–128 characters; set `minLength`, `maxLength`, and the
translated `passwordHint` to match the server's policy. All components accept
`className` and label overrides. Components with links accept `linkComponent`.

When `requestResetHref` is provided, the reset form places “Request a new link”
beside the new-password hint, wrapping below it on narrow screens. Invalid reset
links retain that recovery action beneath the error. It is hidden when recovery
is unavailable or the password reset succeeds. `loginHref` still controls the
separate “Back to sign in” link.

Every password input has a trailing eye button, including login, reset/change,
account security and employee creation. Passwords start hidden; Show/Hide toggles
preserve the value and never submit the form. Override `showPassword` and
`hidePassword` in the corresponding labels to translate both the accessible name
and tooltip. Controls support keyboard activation and are disabled while pending.
Successful submission hides the password again; reopening employee creation also
starts hidden. Password text and visibility are never stored in browser storage.

Reset and change forms ask for the new password once, without confirmation.
Signed-in changes require the current password too. Both fields have independent
Show/Hide controls. The current password is required but is not constrained by the
new-password length policy, so older credentials remain usable.

`ChangePasswordValues` contains `currentPassword` and `newPassword`, preserving the
RC2 callback contract. Hosts that adopted the intervening new-password-only source
must restore current-password validation in their server handler. Keep the
`currentPassword` label override; remove obsolete `confirmPassword` and
`passwordsMismatch` overrides. Forgotten passwords use the email recovery flow.

The host must validate both a fresh session and the current password before each
signed-in change, derive the target account from that session, enforce the new
password policy and preserve CSRF protection, session revocation and onboarding
rules. Never accept a target user ID from the form or expose an admin reset
operation to the browser. Reject incorrect current passwords without changing
credentials. Registry installation alone does not implement this server operation.

The host owns reset-token parsing and validation, expiry and single-use rules,
email delivery, rate limiting, session revocation, and navigation. `validLink`
only controls presentation. Always validate the token on the server. Key the
reset form by the token so a new recovery link resets its draft and success state:

```tsx
<ResetPasswordForm
  key={token ?? "invalid"}
  validLink={Boolean(token) && !error}
  enabled={recoveryAvailable}
  loginHref={`/${locale}/login`}
  requestResetHref={`/${locale}/forgot-password`}
  labels={dictionary.auth}
  onResetPassword={async (newPassword) => {
    await resetPassword({ token, newPassword });
    clearCachedSession();
  }}
/>
```

Recovery confirmation is deliberately the same for known and unknown accounts.
Keep that behavior in the endpoint too. The default copy makes no promise about
link expiry; the host can supply its actual expiry through `checkSpam`.

## Account sections and email

`AccountPage` accepts `tabs: AccountTab[]`, each with a unique `id`, translated
`label` and `content`. Reserve `about` and `security` for Auth. Supply only sections
authorized for the current account; an Employee or Customer plugin does not
register itself or fetch data automatically. About and plugin panels retain mounted form
state when switching tabs.

Use `activeTab` and `onTabChange` for host URL state and unsaved-change guards.
Validate unknown tab IDs and preserve unrelated search parameters. Existing
uncontrolled usage and the complete `header`/`content` override still work.

`onChangeEmail(newEmail)` adds a separate form below About. Translate it with
`emailChangeLabels`, or compose exported `AccountEmailChange` in a custom page.
Only supply this callback for eligible administrators. The host derives the
target from its fresh session, checks CSRF/rate limits and uses the authentication
provider's old/new-address confirmation flow. The form never replaces `user.email`
or marks it verified. It retains failed input, blocks duplicates and reports
that confirmation is needed. Installing source does not enable a provider endpoint.

`tests/account-collaboration.browser.mjs` covers URL navigation/reload, retained
input and pending requests across tabs, duplicate prevention and stable feedback
layout. The showroom simulates confirmation; delivery remains a host integration.

## Employee UI

The employee table uses [`@forge/table-pagination`](./table-pagination.md), installed
with the plugin. Hosts retain the existing total, offset and translated labels.

`EmployeesPage` receives the current page of employees, total, offset,
`onOffsetChange`, `currentUserId`, `currentUserRole`, `onCreate`, and async action callbacks.
The default page size is exported as `EMPLOYEE_PAGE_SIZE`.
Supply `Employee.websitePublished` from the host's public-profile data: `true`
shows a green **Visible on website** badge and `false` a gray **Hidden on website**
badge in the Website column and at the top right of the edit dialog. Omitted
values show **Not provided** in the table and no dialog badge; account access or
email verification never implies publication. Override `website`, `websiteVisible`,
`websiteHidden` and `websiteUnknown` through `labels` for translations.
To make the edit-dialog badge an immediate toggle, supply the optional
`onSetWebsitePublished(id, published)` callback. Clicking it saves visibility
independently of **Save changes**, preserving unsaved account fields. The directory
previews the new status while pending, disables duplicate actions and restores
the previous status with an error if saving fails. Without the callback the badge
remains read-only. Account create/update payloads remain unchanged.
The host must authorize and validate publication, persist the public-profile
status and refresh employee data before resolving the callback. Override
`websiteUpdated` and `websiteError` for translated feedback.
Define the `status-success` and `status-not-started` foreground/background pairs
and their Tailwind mappings before installing the updated item.

`EmployeeCreateDialog.onCreate` receives only name, email and role, and returns
`{ invitationSent: boolean }` after persistence and cache refresh. No password is
assigned by the administrator. A successful delivery closes the dialog. If the
account exists but delivery failed, the dialog explains how to resend from the
list and prevents duplicate creation. `onUpdate` and `onDelete` resolve after persistence and
host cache refresh. `onSendVerification` returns a `sent`, `verified`, or
`unavailable` status. Errors stay visible and allow a retry.

Both employee components require `currentUserRole` from the authenticated session and render
nothing unless it contains Better Auth's exact `admin` role (including `user,admin`).
Missing roles and ordinary employees cannot see the dashboard or creation dialog.
This display check supplements server authorization; it does not protect data by itself.
Protect `/{locale}/intranet/employees` with an admin guard before
loading employee data, and hide their navigation links from non-admins. Keep all employee
queries and mutations behind fresh-session admin middleware and `createEmployeeService`.

The employee list has no enable/disable access action. The old `onSetBan` prop
is optional and unused, so existing hosts can update without changing callbacks.

## Server operations

Create the service inside each protected request using a fresh authenticated
session. Never accept `actor`, request headers, or the verification callback URL
from submitted form data. A route guard does not protect an RPC endpoint.

```ts
import { createEmployeeService } from "@/components/plugins/employees/server/employees.server";

// Inside an authorized server handler, after reading a fresh session:
const employees = createEmployeeService({
  api: auth.api,
  headers: request.headers,
  actor: session.user,
  verificationEnabled: emailDeliveryConfigured,
  sendInvitation: sendEmployeeInvitation,
});
const result = await employees.update(validatedInput);
```

Use Better Auth's `admin` plugin, the `admin` and `user` roles, and the
`mustChangePassword` user field. The service validates inputs and rejects
missing, banned, non-admin, or onboarding actors. It delegates persistence,
password hashing, account/session deletion, and ban/session revocation to
Better Auth. Native Better Auth endpoints also need the host's onboarding
policy; do not expose an unprotected parallel API.

`create(input, invitationURL)` creates a user without credentials, sets
`mustChangePassword` pending activation, and awaits the host's
`sendInvitation(employee, invitationURL)` callback. It returns the created user
and `invitationSent`; delivery failures preserve that account for a retry. With
email unconfigured, creation fails before any account is created.

The host issues a cryptographically random, single-use link with a one-hour
expiry and awaits email delivery. Forge hosts reuse Better Auth's reset-password
verification records and acceptance endpoint. Do not use its public
`requestPasswordReset` result as proof of delivery: background mail errors are
intentionally masked. A recipient chooses their own password; acceptance clears
the pending flag, revokes existing sessions and outstanding links, and preserves
the account's role. Successful use of the emailed invitation/reset token also marks
the address verified before sign-in. Invalid or expired tokens and ordinary signed-in
password changes do not establish email ownership. No bulk verification of existing
accounts is implied. After acceptance, the host signs in the recipient and opens
their localized, role-appropriate destination. Derive the recipient from the valid
invitation token, never from a submitted email. Keep password/session operations
behind the provider's normal validation and rate limits. If session creation fails
after activation, offer login with the new password rather than retrying the
consumed invitation. Clear previous-account caches before entering the app.
Resending replaces earlier links. Administrator edits revoke
outstanding access links. Existing temporary-password accounts retain their
password-change guard until they complete setup; no bulk credential changes or
migration resets are needed.

Updating an email resets its verification
only when the address changes, and an administrator cannot demote themself.
Verification first authorizes the recipient through the admin API, then sends
without forwarding administrator cookies. Construct its callback URL from the
configured site origin and a validated locale before calling
`sendVerification(input, callbackURL, invitationURL)`. Pending accounts receive
an invitation through the host callback; activated accounts retain the existing
email-verification action. Banned accounts cannot be invited. Use the invitation
labels on the localized reset page and preserve neutral public recovery responses.
The host configures Better Auth's trusted origins and email delivery callbacks.

The service imports no framework, environment variables, or site configuration.
Keep it behind a server boundary, such as a TanStack Start server-function
handler or a Next.js server action. It does not install auth, create a database,
apply migrations, or send email during installation.

## Forge Template

Forge Template installs these modules under
`src/intranet/components/forge/plugins/{auth,employees}` so removing
`src/intranet` still removes the entire feature. Its thin route and server
adapters stay outside those directories. The host retains its TanStack link
shim and `cn` adapter when adapting the registry imports.

After updating registry source, run `pnpm registry:sync`, install the generated
items in the consumer, and run its login and employee integration tests against
a disposable local database. Review the diff before overwriting host adapters.

## Action confirmations

Successful updates use the shared [action toast](./action-toast.md). Errors stay
with the form. The dependency installs automatically; wrap the persistent host
layout in `ActionToastProvider` to retain confirmations across navigation and
translate its Close label. Existing callback and label props are unchanged.

## Optimistic employee updates

Employee directory creation, edits and deletion use the shared
[optimistic action contract](./optimistic-actions.md). Authentication, impersonation,
password changes and verification emails still wait for their server result.

## Email templates

Hosts can install [`@forge/mailing`](./mailing.md) for verification and password-reset
messages. Call it from the existing authentication provider callback and keep
localized destinations, token policy, credentials and neutral recovery responses
in the host. It adds HTML and matching plain text without changing the auth UI.

## Account profile and security

Render account pages inside the host's [intranet layout](./intranet.md) for every
signed-in user, including required first-login password changes. Keep the shell
and profile navigation visible while the host filters management links by role.
Route and server guards still block protected operations until onboarding is
complete. Point both the profile link and `profileHref` at the accessible account
route, which may live outside an admin-only route tree.

`AccountPage` owns the profile summary, About/Security tabs and name form. Pass
`user` (id, name, email, optional image/roleLabel), `onUpdateProfile({ name })`,
a `security` node and translated `AccountLabels`. Email is read-only. The active
tab underline overlays the muted divider. State resets when the account ID changes.

Compose `AccountSecurity` in that slot with metadata-only `data` containing the
recorded `signInMethod`, linked `providers`, and sessions (id, current, userAgent,
ipAddress, createdAt, expiresAt). A linked GitHub account is not evidence of the
current session's login method: pass null for untracked sessions. Supply `email`,
`onRetry`, `onRevokeSession(id)` and optional `onRequestPasswordReset`; only credential
accounts show password controls. The optional `passwordForm` slot accepts the
host's `ChangePasswordForm` adapter. Labels, password labels, locale and className
are overridable. Key the adapter by account ID to reset action state between users.

`AgentKeys` takes metadata-only `keys` (id, name, createdAt, lastUsedAt, expiresAt,
expired), `onRetry`, `onCreate({ name, expiresAt }): Promise<{ token }>`, and
`onDelete(id)`. Creation validates a nonblank name of at most 100 characters and
an expiry within 90 days; the server must repeat those checks. The date and time
picker defaults to 30 days and caps selection at 90 days from opening the dialog,
using the device's local time. Browser validation also blocks manually entered
values beyond that maximum before calling the host. The returned token
is held only in component state until the one-time dialog closes or unmounts.
Rows have selection checkboxes and a select-all checkbox with a mixed state for
partial selection. The bulk delete action stays visible in the table header,
disabled with neutral pagination colors until rows are selected. Both single and
bulk deletion require confirmation naming the affected
keys. Bulk deletion calls the existing `onDelete(id)` sequentially for each key;
resolve it only after refreshing host metadata, and reject failed deletions.
Successful keys leave the selection; failures remain selected and in the dialog
for retry without repeating successful deletions. Selection controls and deletion
are disabled while loading or pending. Selection is cleared for removed metadata.
The new selection, confirmation and feedback strings use `SecurityLabels` overrides.
Concurrent submissions are blocked; failures keep
creation drafts or the deletion confirmation available for retry. Successful
profile edits, deletion and copying use the shared action toast.

Both security components accept `loading` and `error`. Keep loaded metadata during
background refreshes; remove `data`/`keys` when authorization fails. The host must
clear private caches on sign-out/account switches and resolve callbacks after
persisting changes; refresh metadata after successful mutations. Optional nodes
allow a host to omit keys or password changes without installing backend features.

The host owns authoritative session validation, user-scoped queries, encryption,
key verification/last-use tracking, expiry enforcement, password/email transport,
impersonation policy and migrations. Never pass session tokens, key hashes or
ciphertext to these components. The server must reject attempts to revoke the
current session or another user's session/key, even when the UI hides the action.
No auth server companion, provider, database or import API is installed.

The account preview uses simulated callbacks. `tests/account.browser.mjs` covers
failed drafts, duplicate submissions, one-time key clearing, expiry validation,
row/select-all selection, confirmed bulk deletion and partial-failure retry,
load retries, credential controls, other-session logout and account navigation
on desktop and mobile, including host-provided content.

### Keep an existing account workflow

For hosts with routed profile sections and custom fields, pass `content` (the
host's navigation and forms) to `AccountPage` instead of `onUpdateProfile` and
`security`. The optional `header` replaces the default title/summary, preserving
custom verification, role and avatar-upload controls. The host retains URLs, Back/
Forward navigation, field validation, save callbacks and access checks. Supplying
`content` does not mount the default form or its two tabs; existing callers are
unchanged. Compose `AccountSecurity` and `AgentKeys` inside the host Security route.

Omit `AgentKeys.onCreate` when the actor cannot create keys. Listing and deletion
remain available, with server ownership checks still required. Metadata can include
`revoked: true`; that state takes precedence over expiry and uses the translated
`revoked` label. These capabilities do not embed a customer's role or import rules.
