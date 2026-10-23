# Email verification on acceptance — 2026-10-12

## Result

All six Forge hosts now persist `emailVerified: true` alongside completed onboarding
in the existing successful `onPasswordReset` callback. Better Auth has consumed the
emailed token and saved the password before invoking that callback. The subsequent
sign-in therefore sees a verified email, and the refreshed employee directory renders
its verified badge. The same emailed-token recovery handler establishes verification;
ordinary signed-in password changes remain unchanged.

This is one additional persisted field per host. No schema, dependency, shared form,
generated registry item or callback API changed. Existing users are not retroactively
verified: an outstanding valid verification email remains the appropriate proof.
TC's custom invitation transaction already persists verification before sign-in.

## Regression evidence

Before the fix, the focused L'Aspic invitation test failed after successful acceptance:
`must_change_password` was false but `email_verified` remained false. The command was
`vpr test:e2e:intranet src/intranet/e2e/invitations.spec.ts -g 'invitations report delivery failure' --workers=1`
with an explicit disposable local `E2E_DATABASE_URL`.

After the fix, the existing browser journeys assert the persisted flag, the automatic
session and the visible verified directory badge for both roles. Invalid/expired
invitations and rejected passwords retain an unverified address. Verification remains
available after automatic sign-in fails, and ordinary emailed recovery also persists it.
Existing verification, email-edit, access-policy and session-revocation cases pass.

| Host | Production browser checks |
| --- | --- |
| l-aspic | 10 passed; Google-provider case skipped |
| forge-template | 9 passed; Google-provider case skipped |
| osthoepathie-seebach | 10 passed; Google-provider case skipped |
| sinigest | 9 passed; Google-provider case skipped |
| soleva | 10 passed; Google-provider case skipped |
| terminal60 | 11 passed; Google-provider case skipped |

All six hosts pass scoped formatting and lint/type checks. Each test run uses the
host's migration history, an isolated local database, intercepted mail and port 3100.
Google OAuth is skipped without provider credentials. No live email, deployed behavior
or real-account data was changed or verified.

L'Aspic's shared output directory and test port were being used by concurrent work.
After port conflicts and an interrupted build, its successful run used an isolated
snapshot of the current tracked source plus working changes, with linked dependencies
and no copied local environment files. The tested auth handler matches the original
checkout byte-for-byte. Other hosts ran in their own checkouts. All six disposable
databases, their role and the temporary L'Aspic snapshot were removed after verification.

## Shared records and scope

The registry guide was edited in an isolated worktree. Its pre-existing auto-sign-in
documentation was copied as a recorded baseline; only the verification wording was
transferred back, then format/diff checked before removing the worktree and branch.
Distribution is unchanged, so no new shadcn installation or registry build is needed.

The existing single-use-invitations OpenSpec root owns this follow-up. Strict validation
passes all 27 items; consumer YAML parses and task diffs pass whitespace checks.
`email-verification-files.json` identifies the follow-up files. These edits remain
uncommitted and unpublished; earlier invitation work and concurrent member-permission
changes remain intact. Stage only this follow-up's hunks when files contain other work.
