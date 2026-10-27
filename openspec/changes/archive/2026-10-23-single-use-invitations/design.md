# Design

Registry owns form validation, invitation/resend labels and the authorized
employee service. Hosts own token persistence, provider delivery, locale, reset
routes and session/cache updates. `onCreate` returns `invitationSent`; the service
receives a delivery callback that rejects on failure. Better Auth deliberately
masks public recovery delivery failures, so its response cannot report admin
invitation delivery.

Forge sites issue random 256-bit tokens in existing reset-password verification
records, expiring after one hour. The existing Better Auth endpoint consumes them
and sets credentials. Issuance locks the recipient while replacing older tokens;
acceptance clears onboarding, outstanding links and sessions. Admin account edits
invalidate unused reset links. Public recovery keeps neutral responses.
Existing temporary-password accounts retain the legacy guard and can complete setup.

TC retains its custom recipient/role/email/employment binding, hashed tokens and
row-locked acceptance. Its invitation no longer requires a temporary password;
new links expire after one hour. Legacy two-part tokens require reissuing, avoiding
a silent reduction of proof for previously shared links. Customer creation without
an email remains supported; invitation generation follows only a usable address.
TC's existing copy-link workflow remains host-owned; employee mail uses the same
invitation acceptance path. Preserve custom HR permissions and account roles.

No live mail, production migration, reset or deployment is part of validation.

## Automatic sign-in after acceptance

The six Forge host adapters resolve only the email bound to an unexpired token for
an unbanned, pending account. The browser then uses Better Auth's existing reset and
sign-in endpoints, retaining their rate limits and session policies. The token is
still consumed by the reset endpoint; recipient lookup alone does not grant access.
After sign-in, a fresh navigation through the localized login guard applies each
site's existing role destination without carrying cached data from another account.
Failure after password creation preserves the login fallback. Password recovery
without the invitation flag retains its existing behavior. TC already performs
validated invitation acceptance followed by sign-in, so it needs no new code.

The registry form's awaited callback already supports this behavior. Only its host
integration guide changes; generated distribution and the manifest remain unchanged.

## Email verification on acceptance

Forge's successful `onPasswordReset` callback clears onboarding and sets
`emailVerified` together. Better Auth invokes it only after consuming the emailed
setup/recovery token and saving the password, before the following automatic sign-in.
The new session therefore contains the persisted verification flag. A later sign-in
failure preserves verification, while invalid/expired tokens and rejected passwords
never reach this callback. The signed-in change-password handler is unchanged and
establishes no email ownership. TC already marks email verified inside its custom
invitation transaction. No migration or bulk verification of existing users is needed.
