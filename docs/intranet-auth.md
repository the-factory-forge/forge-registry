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
password change, account/security (`/en/account`), and access-denied states.
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

Place the recovery forms and `ChangePasswordPage` inside `AuthLayout` or the
host's authentication layout. Embed `ChangePasswordForm` directly in a profile
security section. `AccessDeniedPage` is a standalone page with `homeHref`.
It displays a permission message; the host still guards the route and server.

`ChangePasswordPage` uses the same open layout, left-aligned heading and full-width
submit button as `ResetPasswordForm`. The embedded `ChangePasswordForm` keeps its
compact submit button for account security sections.

| Component                                   | Host callback and state                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ForgotPasswordForm`                        | `onRequestReset(email): Promise<void>`, optional `enabled`, `loginHref`                                                  |
| `ResetPasswordForm`                         | `onResetPassword(newPassword): Promise<void>`, required `validLink`, optional `enabled`, `loginHref`, `requestResetHref` |
| `ChangePasswordForm` / `ChangePasswordPage` | `onChangePassword({ newPassword }): Promise<void>`                                                                       |

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

Reset and change forms ask for the new password once. Signed-in password changes,
including the account security form, do not ask for the current password. Email
recovery remains available through the host's reset flow if the new password is
forgotten.

When adopting this version, migrate the host change-password callback and server
input together: `ChangePasswordValues` now contains only `newPassword`. Remove
the obsolete `currentPassword`, `confirmPassword`, and `passwordsMismatch` label
overrides and update any error copy that asks for the current password. Existing
handlers requiring the old password are incompatible; passing an empty password
to Better Auth's `changePassword` endpoint is not a migration.

The host must authorize each change against a fresh server-validated session,
derive the target account from that session, enforce password policy and preserve
CSRF protection, session revocation and onboarding rules. Never accept a target
user ID from the form or expose an admin password-reset operation to the browser.
A signed-in session now authorizes the change without a second password check;
access to that session is enough to replace the password. Registry installation
alone does not implement this host-owned server operation.

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

`EmployeeCreateDialog.onCreate` receives validated values including the temporary
password and closes after a successful mutation. `onUpdate` and `onDelete` resolve after persistence and
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
});
const result = await employees.update(validatedInput);
```

Use Better Auth's `admin` plugin, the `admin` and `user` roles, and the
`mustChangePassword` user field. The service validates inputs and rejects
missing, banned, non-admin, or onboarding actors. It delegates persistence,
password hashing, account/session deletion, and ban/session revocation to
Better Auth. Native Better Auth endpoints also need the host's onboarding
policy; do not expose an unprotected parallel API.

Creation sets `mustChangePassword`. Updating an email resets its verification
only when the address changes, and an administrator cannot demote themself.
Verification first authorizes the recipient through the admin API, then sends
without forwarding administrator cookies. Construct its callback URL from the
configured site origin and a validated locale before calling `sendVerification`.
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
an expiry within 90 days; the server must repeat those checks. The returned token
is held only in component state until the one-time dialog closes or unmounts.
Deletion requires confirmation. Concurrent submissions are blocked; failures keep
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
load retries, credential controls, other-session logout and narrow layouts.

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
