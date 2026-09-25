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

The showroom lists one `/en/auth` example with links to sign-in, password recovery,
password change, and access-denied states. The old `/en/login` URL and the other
auth example URLs remain available. `/en/employees` previews employee management.
These examples use in-memory callbacks, never retain passwords, and do not create
sessions or send messages.

## Host integration

The host owns localized routes, dictionaries, branding, Query caches, auth
configuration, database migrations, and email transport. Keep those adapters
outside the installed module directories so updates do not overwrite them.
All visible labels have English defaults and accept translated overrides.
The link shim can be replaced by the host or passed through `linkComponent`.

`AuthLayout` accepts `siteName`, `logoSrc`, `homeHref`, `privacyHref`, and an
optional `languageControl`. It preserves the exact agency footer credit.
On desktop, its left panel is narrower than the form side and keeps its own
viewport-height minimum. Longer auth content can extend the right side without
stretching the left panel or pushing its copy to the bottom. The dark backdrop
continues below the left panel when the form side is taller.

`LoginForm.onSignIn` receives `{ email, password, rememberMe }`. Reject its
promise when authentication fails; resolve only after successful authentication
and the host's cache refresh/navigation. The form handles pending state,
password visibility, duplicate submission prevention, and generic failure copy.
Supply `onGoogleSignIn(): Promise<void>` to show Google, the only social provider.
Omit it when Google is not configured. The host performs OAuth and supplies a
trusted callback URL. Credentials stay in the form and callback,
not browser storage. `forgotPasswordHref` links to the host's recovery flow.

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

`EmployeesPage` receives the current page of employees, total, offset,
`onOffsetChange`, `currentUserId`, `currentUserRole`, `onCreate`, and async action callbacks.
The default page size is exported as `EMPLOYEE_PAGE_SIZE`.
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
