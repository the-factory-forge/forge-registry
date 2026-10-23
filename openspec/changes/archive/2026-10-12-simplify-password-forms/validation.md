# Validation

## Registry and consumer checks

- Pinned pnpm 12.8.1 ran format, lint:fix, registry:sync, registry:check, typecheck,
  check, test and build successfully. Check reported zero errors and 195 warnings
  in existing lint categories. The global pnpm shim failed with ENOEXEC; the
  installed native 12.8.1 binary worked with verify-deps-before-run disabled for
  the worktree's linked existing dependencies. No dependency files were changed.
- All 84 unit tests passed.
- All 10 production-built browser tests in login.browser.mjs,
  account.browser.mjs and showroom-height.browser.mjs passed. Coverage includes
  exactly one password input, the newPassword-only form payload, invalid length,
  configurable limits, duplicate submissions, retained failures, error association,
  fixed input position across failure, clearing on success, account submission,
  invalid reset links, keyboard navigation, SSR and narrow layouts.
- Inspected reset and change-page screenshots at 390px and 1440px in both Light
  and Dark. Fields, headings, actions and footer remain readable without horizontal
  overflow. The mechanical Impeccable detector reported no findings for the
  changed form. Existing design-sidecar staleness was left outside this task.
- shadcn 4.21.1 installed named @forge/auth and all dependencies from the local
  namespace into /private/tmp/forge-password-consumer (19 files). The consumer's
  TypeScript check passed; installed source has no old/confirmation inputs and
  calls onChangePassword with only newPassword. Its namespace was restored to
  the published URL after verification. No real consumer was changed.
- Generated public/r/auth.json was built by shadcn; it is the only changed endpoint.
  No manifest or dependency change is needed. git diff --check passed.
- OpenSpec 1.13.0 validates the focused change and all 23 worktree items with
  --strict --no-interactive. Existing long-requirement and already-synced delta
  information remains outside the task. The original spec checkout has additional
  unrelated edits and is validated separately after transfer.

## Limits

No live authentication, email delivery, database, customer server or deployment
was exercised. These are portable UI checks with simulated callbacks. The user
explicitly deferred propagation to Forge Template, L'Aspic and other customers.
Their current-password server contracts must be migrated before installing the
new callback. A valid signed-in session will authorize a change without a second
password check; server authority, CSRF and session revocation remain host duties.

## Transfer

All nine transferred registry files match the tested worktree byte for byte;
every generated Auth file matches its current source. Original-checkout
registry:check, typecheck, check and git diff --check pass, with zero errors and
195 lint warnings. OpenSpec strict validation passes in the original spec checkout
as well (27 items), including its pre-existing unrelated changes.

Existing spec edits are preserved by transferring only the delta against the two
copied working-tree baselines. The original branches remain main and staged
contents are unchanged. Changes remain uncommitted and nothing is pushed. The
local test server is stopped; temporary worktrees and task branches are removed
after this verified transfer.
