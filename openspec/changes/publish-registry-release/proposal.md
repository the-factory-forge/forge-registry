# Publish the Forge registry release

## Why

The [registry release setup](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/changes/archive/2026-10-23-define-registry-releases/proposal.md) defines the process, but publication needs a separately authorized, verified remote outcome. A local package version or pushed RC tag is not a published GitHub Release.

## What Changes

- Take the completed candidate tuple from [prepare-registry-release](../prepare-registry-release/proposal.md), with its check evidence and reviewed notes.
- Verify publication authority, remote tag identity and repository release settings; require immutability for a stable release.
- Publish only that candidate and its complete notes/assets, then read back the release and resolved tag SHA.
- Record the actual outcome and inspect remote state before retrying an ambiguous failure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change applies existing release contracts without changing their requirements; `.openspec.yaml` declares `skip_specs: true`.

## Impact

Owns only `forge-registry` publication under the existing [registry release contract](../../specs/registry-releases/spec.md) and [shared procedure](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/workflows/release-source.md). It affects the canonical remote commit/tag, GitHub draft/release, notes and any declared assets. The prepared source covers advertised item APIs, install targets, npm/registry/CSS dependencies,
server companions, host adapters and generated `public/r/` distribution; publication must preserve that checked snapshot.

Execution depends on completed readiness and authority covering the concrete candidate and necessary remote operations. This planning split grants neither. Source changes return to readiness. Customer adoption, mailing rollout, announcements, live migrations and deployment remain outside this change.
