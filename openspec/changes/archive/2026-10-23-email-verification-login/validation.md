# Validation

## Behavior and ownership

Verification emails now use a configured-origin localized login callback carrying
the recipient email and presentation success marker. Better Auth still verifies
the original token and appends provider errors; error feedback takes precedence.
The editable prefill and toast live in the reusable Auth LoginForm. Route parsing,
French labels, mail rendering and onboarding remain in L'Aspic. No permissions,
schema, credentials, customer palette or toast renderer changed.

Registry source files are registry/components/plugins/auth/index.tsx and labels.ts,
owned only by auth. They target @components/plugins/auth and remain relocated to
src/intranet/components/forge/plugins/login in the site. Auth's existing action-toast
dependency is sufficient; no manifest or dependency changes were necessary.
Reverse dependencies intranet-sidebar and intranet-shell were reviewed. The five
other recorded login hosts remain pending adoption. TC's actual imports use only
account/security components; unknown consumers are explicitly uninspected.

## Checks

- Red regression: the production-built employee verification journey opened login but failed because its email field was empty. The focused browser assertion failed in 13.3 seconds after the build.
- Site lint/type checking and final `vpr check` passed with zero errors and 17 existing warnings.
- Two production-built verification journeys passed, covering real token verification, invalid tokens without success feedback, absent callbacks, plus-address email encoding, editable login and required password changes. The existing password-recovery journey passed separately.
- Reviewed light/dark login screenshots at 390 and 1440 pixels. No horizontal overflow; the toast remains fixed and can be dismissed from the keyboard. Email delivery was intercepted locally and no real messages were sent.
- Registry format, lint:fix, registry:sync, registry:check, typecheck, check and production build passed. The check reports zero errors and existing warnings.
- All 84 registry unit tests and all six Auth browser tests passed, including prefill, a single toast across rerenders, editable drafts and error-only feedback.
- shadcn 4.21.1 installed named @forge/auth and its dependencies into /private/tmp/forge-auth-install-consumer from the entire temporary local namespace. All 19 declared/dependency files were created, installed props and toast dependency were checked, and consumer TypeScript passed. The exact original namespace was restored. The unpinned consumer resolved Base UI 1.9.0, cnfast 0.2.0 and lucide-react 1.55.0; the registry checks used its own pinned versions.
- This OpenSpec change passes strict validation. The repository-wide strict check reports 11 passed and 16 failed in other existing specs/change artifacts, including long requirements and previously duplicated deltas. No unrelated specification cleanup was attempted.

## Transfer and limitations

The isolated registry worktree started from clean main at
616c5850b847b020b7526c476c50a69622d6c116, with no copied uncommitted baseline.
While the task ran, the original advanced to d8beeb2e9a06a6bb5378c1cc0e3e02146c9346cd
and acquired unrelated account edits. The focused source/docs/test patch applied
cleanly; generated Auth JSON was rebuilt from the combined current source and
verified against it, preserving those edits and the staged index.

Changes are local and uncommitted. No publication, deployment, production migration
or production-email check occurred. Previously sent messages retain their original
callbacks and need a newly issued verification email after deployment. Other
consumer updates are separate follow-ups. Disposable tests do not verify inbox
rendering, delivery or a deployed host's origin configuration.

The original registry checkout passes `vpr check` after transfer. Task source and
tests match the verified worktree, and generated Auth content matches current
source. The temporary registry server, worktree/branch and disposable PostgreSQL
container were removed after verification.
