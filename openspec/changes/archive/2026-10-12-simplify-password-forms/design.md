# Design

`registry/components/plugins/auth/password-forms.tsx` is shared by reset,
change-password and account-security examples. Auth owns this file and
`password-labels.ts`; `intranet-sidebar` and `intranet-shell` depend transitively
on Auth. Existing exports and component names remain unchanged.

Remove confirmation state and both extra inputs at the shared form. Keep
`ChangePasswordValues` as an object containing only `newPassword`. Reuse the
submission lock, policy props, autocomplete, toast and reset-link behavior.
Reserve the translated error's space and associate it with the remaining input.
No credential is copied into browser storage or preview state.

This intentionally breaks hosts that require `currentPassword`. The inspected
Forge Template handler in `src/intranet/auth/functions.ts` still uses Better Auth's
current-password endpoint; installing this UI without changing that handler will
fail. Migration must validate the session at the server, derive its own target
user, preserve CSRF, session revocation and onboarding rules, and change the
password without substituting an empty old password. A signed-in session is now
sufficient authority for a change, so access to that session is a material risk.
Reset still requires a valid server-checked email token.

ADR-0002 (portable UI and host adapters) and ADR-0005 (optional intranet and server
authority) retain ownership: authentication implementation stays in each host.
The user deferred every consumer update. Inventory evidence identifies known
consumers, but uninspected installations and live deployments remain unknown.

Registry baseline: clean `main` at aae121a1066622f5a1a3c99fd66839208bb8f66e.
Spec baseline: `main` at cb011da03c35eaa5a053a0c1efc289f1c9ca4db6 with existing
uncommitted work. Only the current Plugins spec and consumer inventory were copied
into the isolated spec worktree; task diffs are computed against those copies.
