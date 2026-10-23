## Shared source and consumers

- [x] forge-registry: remove temporary-password input, add delivery result and invitation callback, update examples and tests.
- [x] forge-template, l-aspic, osthoepathie-seebach, sinigest, soleva, terminal60: reconcile host issuance, email, acceptance, translations and browser tests.
- [x] TC website: reconcile custom customer/employee invitation creation, acceptance and forms.
- [x] forge-spec: define the shared contract and identify affected consumers.
- [x] forge-registry: finish distribution, browser and required checks; transfer task diff and remove worktree.
- [x] all application repositories: pass scoped checks and record exact results.
- [x] forge-spec: record adoption evidence and validate changes.

## Invitation auto sign-in follow-up

- [x] Six Forge hosts: add token-bound recipient lookup, sign in after activation and preserve the login fallback.
- [x] Six Forge hosts: verify member/admin entry, rejected/failed sign-in and invalid invitation cases with disposable browser tests and lint/type checks.
- [x] forge-registry: document the host callback behavior and transfer its isolated documentation change.
- [x] forge-spec: reconcile the contract and record consumer/check evidence; confirm TC's existing behavior.

## Email verification follow-up

- [x] Six Forge hosts: persist email verification during successful invitation acceptance before automatic sign-in.
- [x] Six Forge hosts: verify stored/session verification, the directory badge, rejected tokens/passwords and login failure through browser tests and lint/type checks.
- [x] forge-registry and forge-spec: update the host guide and shared contract, record adoption and checks; confirm TC already persists verification.
