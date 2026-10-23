# Design

## Context

See [proposal](proposal.md). Release setup and source tags already exist; the
2026-10-23 review found no GitHub Releases. Refresh that remote observation before
execution. [Readiness](../prepare-registry-release/proposal.md) owns candidate choice
and checks; no version or SHA is selected by this planning change.

## Goals / Non-Goals

**Goal:** publish and verify exactly the reviewed candidate.
**Non-goal:** expand an approval to a changed snapshot, customer rollout or settings
changes it did not cover.

## Decisions

### Reuse the verified handoff

Require the readiness tuple: repository, full SHA, version/tag, notes, assets,
prerelease/latest choice and check evidence. Confirm it still matches source.
The tuple must contain the checked manifest, generated catalog/items and complete
npm/registry/CSS dependency and companion notes. Verify the candidate exposes its
`public/r/` files at the full SHA; publishing does not refresh installed consumers.

### Complete prerequisites before publication

Follow the shared source-release procedure and existing release tooling. Reuse
explicit authority that covers the concrete tuple and necessary commit/tag push
and GitHub Release operations. If missing, present that prepared tuple for approval.
Verify actual repository settings; stable publication requires release immutability
and any settings change needs its own authority. A prerelease stays prerelease and
not latest. Missing prerequisites keep this change active.

### Verify identity and recover from remote evidence

Prefer an existing verified tag and a GitHub draft; check the resolved full tag SHA
separately from tag existence. Push only authorized commits/tags if needed. Attach
complete notes/assets before publication, then read back repository, release URL,
tag SHA, flags and assets. Inspect remote state after an uncertain result and
resume only a matching draft. A conflicting tag stops the operation; never force it.

## Risks / Trade-offs

- Branch or tag drift can publish unchecked source → compare against the exact tuple;
  changed source returns to readiness.
- Immutability may be unavailable → stable publication stays blocked under existing policy.
- Partial remote success can duplicate work → inspect before retrying and preserve evidence.

## Migration Plan

Publication changes remote release state only. A defective published version is
marked unsuitable with an explicit notes correction; source fixes require a new
version. Customer adoption, migrations and deployment remain separately authorized.
