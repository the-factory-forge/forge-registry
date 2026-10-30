---
name: sync-from-forge-registry
description: Pull selected forge-registry items and companions into a customer website while preserving its customizations and exclusions. Use for downstream registry updates, not promoting a site change upstream or syncing the template foundation.
---

# Update a site from Factory Registry

Update only the requested installed item subset and its necessary integration.
`$sync-to-forge-registry` is the separate upstream-promotion skill; this skill pulls
source into a site. Its canonical source is
`forge-registry/.agents/skills/sync-from-forge-registry/`. Read it from the actual
registry checkout or install it from that source; customer installations do not
become a second maintained source.

## Establish scope and evidence

Locate the site, `forge-registry` and `forge-spec` by their actual paths/remotes.
Read each applicable `AGENTS.md`, the affected registry item guides, and shared
`registry-distribution`, `site-template`, `plugins` and relevant UI contracts.
Use existing site sync/install notes and `forge-spec/consumers/` evidence; read a
site adoption record if present. The proposed `factory/adoption.yaml` format is
not assumed to exist. The [adoption design](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/changes/track-customer-source-adoption/design.md)
describes a future rollout, not permission to create records across customer sites.

Record the customer's starting commit, branch and dirty changes. Use an isolated
branch/worktree per repository instructions, preserving unrelated work. Confirm
requested items against actual imports, routes and wiring. Include companions and
dependencies only as required; a plugin's presence is not permission to install
every optional companion or re-enable absent intranet/auth.

For each selected item, identify the expected customer behavior and trace its
installed source, host callbacks/transport, authorization, cache updates and data
prerequisites. An optional client method can preserve compatibility while leaving
a requested feature invisible. Its optional type, or an earlier agent's exclusion
note alone, is not evidence that the customer chose to exclude that behavior.
Preserve confirmed product exclusions; complete missing integration within the
authorized scope or report the behavior as pending. Ask only when a product choice
is genuinely unresolved, not to reconfirm work already authorized.

Resolve a selected published release to its verified full commit SHA. Use explicit
user targets when supplied. If no release exists or an unreleased target is
requested, record the exact commit and its unreleased status. A configured `main`
URL and a package version prove neither target freshness nor installed adoption.
Report inaccessible remote evidence rather than calling a local revision latest.

## Reconstruct and reconcile

Trace selected source/companions and dependency closure through the manifest,
`components.json`, aliases and actual installed paths. Identify every owner and
reverse dependent of shared files, including site items outside the requested
subset. Preserve compatible existing shared copies; if required changes affect
another installed item, review that impact rather than silently broadening a refresh.

Materialize three trees: proven pristine installed baseline, current customer
source, and incoming installed source. The base must reproduce post-install
paths/imports/alias rewrites and relevant dependency resolution. Use retained
snapshots or verified replay with retrievable inputs; a hash or raw source SHA
alone cannot reconstruct transformed installed bytes. Preserve the comparison
inputs/evidence in the site's existing sync convention, excluding secrets/data.

For the incoming tree, install affected named items with pinned shadcn in a
disposable consumer, configuring the entire `@forge` namespace at the selected
SHA so its registry dependencies resolve there too. Capture external dependency
resolution and transformations. Restore temporary configuration on success or
failure; retain a persistent namespace change only as part of the intended diff.

Compare and reconcile the selected delta into the isolated site. Shared Git
ancestry is unnecessary. If the base is absent/mixed, manually reconcile bounded
behavior/paths against current customer and incoming source, preserving explicit
uncertainty. Do not invent a base, bulk-overwrite a file/tree, or use automatic
ours/theirs resolution. Review renames/deletions and cleanly merged changes too.

When source already matches the selected target, retain it and reconcile the
missing host integration. Reuse verified retained installation inputs where they
cover the same target, item closure and transformations; install again when they
do not. A repeated sync may correctly produce no application changes. Do not
overwrite newer host fixes or invent changes to demonstrate that the sync ran.

Keep customer branding, translations, routes, authorization, persistence and
business rules, including deliberate changes inside installed source. Preserve
host shims/adapters and newer site-owned fixes. Check incoming new files, imports,
dependencies and environment requirements against feature exclusions; excluded
intranet/auth must stay absent. Report an incompatible required dependency instead
of enabling it silently. Merge package requirements with site-only dependencies
and regenerate the site's lockfile through its existing toolchain.

Review companion SQL explicitly against applied customer migrations and data.
Prepare incremental migrations only when needed, preserve applied history and
test with disposable data. A source update grants no live migration authority;
document when a source rollback cannot undo a data change.

## Verify and record

Review the complete diff and run repository checks plus the affected customer
journey, including failure/authorization paths when relevant. Verify changed
translations, layout/themes and optional-feature boundaries as applicable. A
textually clean merge, JSON parse or showroom preview does not prove the site's
behavior. Do not send production email or use production data to validate.

Exercise the actual host adapter and visible customer journey, not only the
portable source or persistence companion. For a missing integration, first
reproduce the absent behavior, then verify it works through that same host path.
Include relevant access refusals and failure recovery. Record skipped fixtures
and checks as unverified; a passing command with the affected test skipped is not
evidence for that behavior. Inspect existing check/test scripts and PR workflows;
report unwired checks without creating unrelated CI work unless authorized.

Update the existing site sync record, or use `docs/registry-sync.md` when none
exists. Record target, base evidence and retained baseline inputs, item/companion
scope, path transformations, exclusions, local deviations, passed/blocked checks
and outstanding work. A partial update advances only its proven scope; unknown
baselines remain unknown. Do not mark an entire plugin current after one backport.
Update any existing adoption record consistently without assuming the future schema.

In that same record, distinguish source installed, host integration connected,
journey verified, intentionally excluded with decision evidence, and pending work
for each expected capability. Record data preparation separately from source
adoption. State the tested customer commit or exact pre-commit tree. Later runtime
changes require affected checks again; documentation-only changes may reuse tests
when the relevant runtime files are proved unchanged. Surface missing expected
behavior in the handoff, not only in a linked technical report.

Refresh the central inventory's dated evidence and update status for the authorized
site, preserving unrelated follow-ups. Failed/incomplete work stays pending; local
adoption does not establish deployment. Existing explicit authorization covers
normal reversible update work without routine reapproval; ask only for genuinely
missing scope. Commits, pushes, live migrations, deployment and other-site rollouts
need their own applicable authority. Finish with the reviewable diff, exact source
identity, scope, checks and unresolved decisions.
