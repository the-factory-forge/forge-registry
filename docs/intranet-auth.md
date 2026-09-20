# Login and employees

Install the source modules with the configured `@forge` namespace:

```sh
pnpm exec shadcn add @forge/login @forge/employees @forge/employees-server
```

`login` ships `LoginForm` and `AuthLayout` under `components/plugins/login`.
`employees` ships `EmployeesPage`, `EmployeeNewPage`, action dialogs, labels,
and validation under `components/plugins/employees`. `employees-server` adds
`server/employees.server.ts`. The browser exports never import that server module.

The showroom has `/en/login` and `/en/employees` examples. They use in-memory
callbacks, never retain passwords, and do not create sessions or send messages.

## Host integration

The host owns localized routes, dictionaries, branding, Query caches, auth
configuration, database migrations, and email transport. Keep those adapters
outside the installed module directories so updates do not overwrite them.
All visible labels have English defaults and accept translated overrides.
The link shim can be replaced by the host or passed through `linkComponent`.

`AuthLayout` accepts `siteName`, `logoSrc`, `homeHref`, `privacyHref`, and an
optional `languageControl`. It preserves the exact agency footer credit.

`LoginForm.onSignIn` receives `{ email, password, rememberMe }`. Reject its
promise when authentication fails; resolve only after successful authentication
and the host's cache refresh/navigation. The form handles pending state,
password visibility, duplicate submission prevention, and generic failure copy.
Supply social providers as `{ id, label, icon, onSignIn }`; the host performs
OAuth and validates its callback URL. Credentials stay in the form and callback,
not browser storage. `forgotPasswordHref` links to the host's recovery flow.

`EmployeesPage` receives the current page of employees, total, offset,
`onOffsetChange`, `currentUserId`, `createHref`, and async action callbacks.
The default page size is exported as `EMPLOYEE_PAGE_SIZE`.
`EmployeeNewPage.onCreate` receives validated values including the temporary
password. `onUpdate`, `onDelete`, and `onSetBan` resolve after persistence and
host cache refresh. `onSendVerification` returns a `sent`, `verified`, or
`unavailable` status. Errors stay visible and allow a retry.

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
`src/intranet/components/forge/plugins/{login,employees}` so removing
`src/intranet` still removes the entire feature. Its thin route and server
adapters stay outside those directories. The host retains its TanStack link
shim and `cn` adapter when adapting the registry imports.

After updating registry source, run `pnpm registry:sync`, install the generated
items in the consumer, and run its login and employee integration tests against
a disposable local database. Review the diff before overwriting host adapters.
