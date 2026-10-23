# Design

## Context

See [proposal](proposal.md) for the split from completed setup.

At the 2026-10-23 review, `package.json` was `0.0.0-rc.4`, with existing
[RC4 notes](../../../docs/releases/v0.0.0-rc.4.md) and an RC4 source tag.
The branch has advanced since that tag; the notes are historical evidence.

The [RC2 installation record](../../../docs/releases/v0.0.0-rc.2.md#validation)
describes a combined shadcn install rewriting Reservations' Mailing `renderEmail`
import to Auth. Reinstalling `reservations-storage` separately passed then.
Reproduce the candidate's supported installation paths before deciding whether
that limitation remains; neither assume a current defect nor inherit the old pass.

## Goals / Non-Goals

**Goal:** provide one reproducible candidate and its current readiness evidence.
**Non-goal:** choose a version from historical notes or certify customer adoption.

## Decisions

### Select and verify the actual candidate

Refresh canonical tags/releases and settings when execution starts. Select the
previous release and full source diff, then choose the version by consumer impact.
Reuse an existing tag only if its source and evidence are the intended candidate;
never move it to newer source. A new source snapshot needs an unused version/tag.

### Apply repository-specific checks

Use `registry/registry.json` plus old and incoming manifests to trace changed
files, shared-file owners and direct/reverse dependency closure. For the first
published release, inspect every advertised item and document the supported
baseline. Review public props, install targets, npm and CSS dependencies, server
companions and host setup. Rebuild `public/r/` with the official builder after
formatting. Test clean shadcn consumers without showroom aliases; all `@forge`
requests must resolve to the same candidate output. A local registry server may
exercise unpublished output without pushing it. Read the consumer inventory for
impact, preserving unknowns and leaving site updates to their own changes.

### Keep the handoff concrete

Use the shared `forge-skills/release` workflow, not a new release script. Record
reviewed notes and checks in `docs/releases/v<version>.md`, matching `package.json`.
Use the local commit and annotated tag to resolve the final full SHA; do not put
the record's own SHA inside itself. Capture repository, version/tag, SHA,
prerelease/latest choice, notes, assets or none, and passed/blocked/omitted checks
in this change's validation evidence for [publication](../publish-registry-release/proposal.md).
No push is part of readiness. Recheck affected gates after candidate changes.

## Risks / Trade-offs

- Historical RC checks can miss newer source → validate the selected snapshot.
- Required checks or contract disagreements may remain unresolved → keep readiness
  open; do not treat missing prerequisites as passes or publish stable source.
- Unrelated local edits can enter a release → isolate the candidate and review its diff.

## Migration Plan

Record required source/data migration instructions, or an explicit reviewed
absence, in the notes. Tests use disposable services; customer migrations and
deployment are separate. Preserve existing tags and migration history.
