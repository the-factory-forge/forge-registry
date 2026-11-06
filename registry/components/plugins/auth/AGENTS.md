# Auth

Auth supplies account and credential UI over host callbacks. Read the
[integration guide](../../../../docs/intranet-auth.md) and
[Auth requirements](../../../../openspec/specs/plugins/spec.md#requirement-auth-plugin)
before changing authentication flows.

## Logic and ownership

- `index.tsx` owns login and the browser exports. `auth-controls.tsx` shares the
  pending/failure guard between password, Google sign-in and sign-out. Success
  keeps controls disabled until the host finishes navigation or unmounts them.
- `password-forms.tsx` owns recovery, reset and signed-in changes. Hydration guards
  and POST forms prevent credentials entering native submission URLs. Reset and
  change accept one new password; signed-in changes also require the current one.
- `account-page.tsx` composes About, host-supplied plugin tabs and Security. About
  and plugin panels stay mounted to retain drafts; Security unmounts when hidden
  to clear secrets. `account-email-change.tsx` requests confirmation without
  changing the displayed account identity or verification state itself.
- `account-security.tsx` owns session controls and slots for host-wired password
  and key UI. `agent-keys.tsx` uses the shared table selection deletion lifecycle.

## Change boundaries

The host owns sessions, token checks, current-password verification, CSRF,
rate limits and delivery. UI `validLink` and verification feedback grant no access.
Keep recovery responses identical for known and unknown accounts. Passwords and
visibility state remain local to the mounted form.

When changing shared auth controls, inspect the
[intranet sidebar](../../intranet-sidebar.tsx) caller too. Account tabs may host
Employees or Customers content without installing or fetching either plugin.

## Checks

Use [auth hydration](../../../../tests/auth-hydration.browser.mjs) for credential
submission changes and [account collaboration](../../../../tests/account-collaboration.browser.mjs)
for tabs and email requests. Inspect `src/showroom/auth-preview.tsx` and
`src/showroom/account-preview.tsx`; their callbacks simulate authentication.
Real provider/token behavior needs host integration checks from the guide.
