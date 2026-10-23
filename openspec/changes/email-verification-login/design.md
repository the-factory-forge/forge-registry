# Design

The provider continues to validate the issued token. L'Aspic's delivery adapter
normalizes its callback to the configured origin and localized login, encoding
the recipient and a success marker with URLSearchParams. Password-reset links
remain unchanged. Better Auth appends an error on failure; the login adapter gives
that error precedence. Query hints control UI only and confer no authority.

LoginForm owns optional defaultEmail and verificationStatus presentation. It reuses
the existing action-toast provider and guards against duplicate effects. Native
uncontrolled email inputs preserve edits on rerender; a host keys by recipient
when changing links in place. No toast renderer, palette or customer layout is copied.

Registry ownership is auth/index.tsx and auth/labels.ts, installed at
@components/plugins/auth and relocated under src/intranet/components/forge/plugins/login
in L'Aspic. Its full installed baseline is mixed/unknown. The requested delta is
ported by inspection into registry 616c5850b847b020b7526c476c50a69622d6c116.
The clean original registry checkout was main at that commit when the isolated
codex/email-verification-login worktree was created. No uncommitted baseline was
copied. Concurrent account/release edits appearing afterward must be preserved.

Only auth ships the changed shared files. Reverse dependencies are intranet-sidebar
and intranet-shell; neither enables verification callbacks. Known login consumers
are L'Aspic, forge-template, osthoepathie-seebach, sinigest, soleva and terminal60.
TC uses account/security subsets and its custom login, so this change does not
apply there. Unknown generic consumers remain uninspected. Old email messages
keep their original callback and need a newly issued message for the new flow.
