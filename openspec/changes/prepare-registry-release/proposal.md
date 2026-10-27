# Prepare the Forge registry release

## Why

The [registry release setup](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/changes/archive/2026-10-23-define-registry-releases/proposal.md) is complete, but a checked source candidate still needs its own readiness record. Historical RC checks do not certify the current source or authorize publication.

## What Changes

- Select the actual source candidate and version from verified remote history.
- Complete the repository's release checks and reviewed versioned notes, recording failures and omissions accurately.
- Resolve source/contract disagreements before declaring readiness; track any required behavioral change in its owning OpenSpec root.
- Prepare the local release commit and annotated tag with the shared release skill, then hand the verified candidate to [publish-registry-release](../publish-registry-release/proposal.md).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change applies existing release contracts without changing their requirements; `.openspec.yaml` declares `skip_specs: true`.

## Impact

Owns only `forge-registry` readiness under the existing [registry release contract](../../specs/registry-releases/spec.md) and [shared procedure](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/workflows/release-source.md). Review covers advertised item APIs, install targets, npm/registry/CSS dependencies,
server companions, host adapters and generated `public/r/` distribution.

Expected outputs are matching `package.json`, `docs/releases/v<version>.md`, a local commit/tag and validation evidence. Any necessary source repair must remain scoped to a failed release gate. This planning split selects no version and runs no release checks. Customer adoption and mailing rollout retain their existing active changes; publication and deployment are outside this preparation change.
