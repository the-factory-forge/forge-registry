# Tasks

## 1. Candidate and impact review

- [ ] 1.1 Refresh canonical remote tags, releases and settings; record the selected source SHA, previous release, version rationale and immutable-release prerequisites, preserving unrelated edits and existing tag targets.
- [ ] 1.2 Inspect every advertised item for the first publication and trace affected files through old/new manifests, shared-file owners and direct/reverse dependencies; deliver an impact list covering companions, npm/CSS dependencies, targets, host setup, consumer inventory and unknown consumers.
- [ ] 1.3 Write matching `package.json` and `docs/releases/v<version>.md` notes with supported baseline, item impact, breaking integration, migrations or their absence, adoption checks and limitations; verify the version/tag is unused or already identifies exactly this candidate.

## 2. Distribution and behavior checks

- [ ] 2.1 Run formatting and lint fixes, review automatic changes, then rebuild with `pnpm registry:sync`; verify final generated output and pass `registry:check`, `typecheck`, `check`, unit tests and production build against the candidate.
- [ ] 2.2 Verify relevant showroom discovery and interactions plus affected server-companion behavior using the current browser/integration suites and disposable data; record passed, blocked and omitted checks.
- [ ] 2.3 Install advertised items and dependency closures into clean disposable shadcn consumers using one candidate namespace; verify target/import resolution, CSS dependencies, host adapters, types and browser/server separation without showroom aliases.
- [ ] 2.4 Recheck the RC2 combined-install Reservations/Mailing import limitation and the documented standalone-install path; record current reproducible outcomes and resolve failed supported installation gates before declaring readiness.

## 3. Local release handoff

- [ ] 3.1 Use `forge-skills/release` to prepare the local release commit and annotated tag after passing required gates; verify matching package/notes/tag identity, generated artifacts and final full SHA, rechecking affected gates after source changes.
- [ ] 3.2 Record the repository/SHA/version/tag/notes/assets/prerelease/latest tuple and all check outcomes in this change's validation evidence; verify `publish-registry-release` can consume it without selecting a moving branch. Keep readiness open if required checks remain blocked.

## Workflow follow-up

- Validate and archive this change only after its tracked work is complete; preserve unresolved checks as active work.
