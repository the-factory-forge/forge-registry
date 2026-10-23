# Invitation auto sign-in verification — 2026-10-12

## Behavior and ownership

Invited users now sign in immediately after choosing their password. The server
resolves the recipient only from an unexpired token for an unbanned, pending account;
the submitted form does not supply an email. Better Auth's existing reset and sign-in
endpoints retain token consumption, password checks, session policy and rate limits.
A fresh page load clears cached account data and lets the existing localized login
guard choose the destination. L'Aspic members enter the chalet pages, while its admins
enter the intranet. Other hosts preserve their existing intranet destinations.

If the sign-in request fails after activation, the password remains set and the
success message offers ordinary login. The user is never asked to reuse a consumed
invitation. Normal password recovery retains its previous flow.

The registry Auth reset form already awaits its host callback. Its manifest owner is
`auth`, with reverse dependencies `intranet-sidebar` and `intranet-shell`. No distributed
source, public props, generated JSON or dependencies changed. The guide alone was
updated in an isolated worktree, transferred byte-for-byte and format/diff checked in
the original checkout; the worktree and temporary branch were removed. A new shadcn
installation was unnecessary because distribution was unchanged.

TC already implements invitation acceptance followed by sign-in and cache clearing.
Its host functions and route were inspected; no new TC edits were needed. Its two
customer/employee browser journeys passed in the preceding invitation rollout.

## Checks

All six changed hosts pass scoped formatting and lint/type checks. Their production
Playwright runs use disposable local databases, the existing migration histories,
fake mail, and port 3100. Coverage includes immediate entry for members/admins,
HTTP and network sign-in failures, manual-login fallback, invalid/expired/banned/
already-activated recipient lookup, concurrent token use, locale, session revocation
and ordinary recovery. No changes to credentials or data in real site databases occurred.

| Host | Affected browser results |
| --- | --- |
| l-aspic | 10 passed across initial/focused runs; final employee/invitation rerun 6 passed with concurrent permission edits |
| forge-template | 9 passed |
| osthoepathie-seebach | 10 passed |
| sinigest | 9 passed |
| soleva | 10 passed |
| terminal60 | 11 passed |

Each host skips its Google-provider case without provider credentials. L'Aspic's new
invalid-link test initially expected the wrong translated error; its shared form uses
`resetError`. The corrected assertion and all three invitation cases passed on rerun.
An initial callback return-type error was fixed before the passing checks.
Concurrent member-permission edits appeared in L'Aspic during final review. They
were preserved, and the six employee/invitation browser tests plus lint/type checks
passed again against that current checkout.

The recipient lookup and sign-in mutation blocks match across the six hosts; each
retains its imports, forms, translations, optional confirmation and destinations.
OpenSpec strict validation passes all 27 items; consumer YAML parses successfully.

## Handoff

These follow-up changes remain uncommitted and unpublished. The six disposable
verification databases and their test role were removed after checks. Live email,
production behavior and Google OAuth were not verified. Prior unrelated changes in
the template, Soleva and Forge Spec, plus concurrent L'Aspic permission edits, were preserved. `auto-signin-files.json` names the
follow-up scope; stage only these new hunks when a listed file also has earlier work.
