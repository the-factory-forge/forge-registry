# Tasks

## 1. Publication prerequisites

- [ ] 1.1 Read the completed `prepare-registry-release` tuple and evidence, including showroom, generated distribution, clean consumer installation and affected companion checks; verify the selected source, package, notes and tag still match. Return changed source or failed gates to readiness.
- [ ] 1.2 Confirm explicit authority covers this repository/SHA/tag/notes/assets tuple and necessary commit/tag push and GitHub Release operations; reuse existing matching authority or present the concrete tuple for approval.
- [ ] 1.3 Inspect canonical remote history, release drafts and settings; verify stable-release immutability or keep publication blocked, and obtain authority for any required settings change. Record the explicit prerelease/latest choice and reject conflicting tags.

## 2. Publish and verify

- [ ] 2.1 Push only the authorized source/tag if needed, resolve the remote tag to the exact full SHA, and create or reuse a matching GitHub draft with reviewed notes and all required assets; verify the complete draft before publication.
- [ ] 2.2 Publish the reviewed draft with the agreed flags, then read back the release URL, repository, tag SHA and asset inventory. Verify `public/r/` endpoints exist at that full SHA. If any operation has an ambiguous result, inspect remote state before retrying; never force or reuse a conflicting published version.
- [ ] 2.3 Record verified remote identity and publication evidence in this change; confirm customer source, mailing rollout and deployment status are not presented as changed by publication.

## Workflow follow-up

- Validate and archive this change only after its tracked work is complete; preserve unresolved checks as active work.
