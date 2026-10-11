---
name: sync-forge-registry
description: Promote only a customer improvement identified in the current conversation upstream into forge-registry. Use when asked to bring a discussed site change back to shared source, not to pull registry updates into a site or synchronize accumulated customer differences.
---

# Promote a discussed site change to Factory Registry

Implement the discussed improvement against current registry source and identify
affected consumers. `$sync-forge-registry` keeps its upstream meaning; downstream
updates use the template's `$sync-from-forge-registry` skill. The canonical source
of this skill is `forge-registry/.agents/skills/sync-forge-registry/`.

## Bound the requested improvement

Derive scope from the current conversation: state the intended behavior and one
focused acceptance check before editing. Reuse the user's existing scope decision
and authorization for the normal reversible promotion work; this is not a second
approval gate. If the behavior or shared ownership is materially ambiguous, ask
only for the missing scope and continue independent work.

Treat a customer diff as evidence, not the unit of promotion. Isolate interleaved
unrelated edits even within one line, hunk, file or commit. Carry only the behavior
and minimal supporting dependencies needed for its acceptance check. A discussed
button position, for example, does not authorize its surrounding customer layout,
branding or business rules. Do not copy the whole file, accumulated divergence,
all dirty files or a commit containing unrelated work.

## Trace ownership before editing

Locate the source website, `forge-registry` and `forge-spec` from the actual
workspace or their Git remotes. Read their `AGENTS.md`, the affected item guide,
and Forge Spec's `registry-distribution`, `plugins` and relevant host/UI contracts.
Resolve paths from those checkouts; do not assume siblings or a developer's home
directory. If a required checkout is inaccessible, finish independent authorized
work and report the exact missing context.

Inspect staged, unstaged and untracked changes. Follow the
registry's isolated-worktree and transfer procedure, recording any copied baseline.

Trace the page's imports through local wrappers, installed source, `components.json`
and `tsconfig.json` to `registry/registry.json`. Record the owning item IDs, source
files, declared install targets and actual site locations, including relocated
`src/intranet/` files. Use a proven installed baseline, including transformations,
to distinguish upstream source from customer changes when available. A recorded
SHA is useful only within its verified scope; the namespace URL is not a baseline.
If the base is absent or mixed, port the requested behavior through targeted
inspection and record that uncertainty. Do not classify all divergence as reusable
or manufacture a full baseline to proceed.

Separate the correction from customer copy, themes, routes, fields, auth, storage
and business rules. A page-only adaptation stays local; optional props alone do
not make a customer workflow shared. If current registry behavior already satisfies
the scoped acceptance check, report that evidence instead of copying older code.

## Find consumers

Read `forge-spec/consumers/README.md` and `consumers/sites.yaml`. Refresh the
originating site's entry against imports, routes and server wiring. Source files
alone prove presence, not an enabled feature; a similarly named custom feature
is not evidence of an installed Forge plugin.

For each changed item or shared file:

- Find every manifest item shipping it, then recursively follow reverse
  `registryDependencies`, including server companions, to find affected plugins.
- Match those item IDs to the inventory. Inspect recorded host adaptations and
  actual usage before deciding which sites need changes. Include the template as
  a separate consumer; updating it does not update already-generated websites.
- Check known renamed or relocated copies and explicitly recorded standalone
  items. Plugin coverage does not establish that every generic UI consumer is
  known. Flag stale, uninspected or inaccessible consumers as needing review;
  never silently treat unknown usage as absence.

Record affected consumers and reasons in the inventory's `updates` list. Preserve
existing unrelated follow-ups. Distinguish pending review, verified local adoption,
and a documented decision that a change does not apply.

## Promote and reconcile

Implement the smallest reusable delta against the current registry source,
preserving newer registry behavior and the site's unrelated adaptations. Keep
framework integration in shims or host callbacks and shared styles in semantic
tokens. Review each changed line against the scoped behavior, including necessary
supporting changes; retain newer fixes and APIs even when the customer predates
them. Update affected callers, labels, examples, docs and focused tests. Maintain
public APIs unless the requested change includes an intentional migration.

Declare every shipped file, package and registry dependency in
`registry/registry.json`. Format source, then generate `public/r/` with the
repository's `registry:sync` script; never patch generated JSON. Use the actual
package scripts (`vpr` where configured), not retired `registry:pull` commands.
Reconcile shared behavioral contracts in Forge Spec when they change, using its
OpenSpec workflow. Keep customer-only decisions in the site.

Verify distribution through a real shadcn install of the affected named items.
For unpublished changes, serve local generated output and temporarily point the
consumer's entire `@forge` namespace to its `/r/{name}.json` so dependencies also
resolve locally. Use the host's designated test port, leave other servers alone,
and restore the exact previous namespace/configuration even if the install fails.

Use a disposable consumer to verify distribution without refreshing the customer.
Reconcile the originating site only when necessary for the discussed improvement
and within the authorized scope. It may already contain the intended behavior;
then no forward sync is required. If changes are necessary, limit them to that
behavior and its required integration, preserving paths/imports, translations,
permissions, storage and migration history. Do not pull unrelated registry updates
into the originating site as a consequence of this promotion.

## Verify and record

Run the scoped acceptance check and registry's required checks, plus the
originating site's checks and affected journey if its source changed. A showroom
preview or `registry:check` alone does not prove consumer installation. For visual
changes check relevant narrow/wide, theme, keyboard and error states.

Refresh the inventory's inspection date, site commit, dirty-tree qualification,
plugin/companion paths, integration evidence and local differences. Record an
installed registry SHA only when the installation/reconciliation proves it; mark
partial or unpublished adoption as such. Do not claim an entire plugin is current
because one helper was installed or one correction was backported.

Leave other affected websites as explicit follow-ups unless their updates are
already authorized. Reuse that authorization without asking again. Mark an update
`applied-local` only after its relevant consumer checks pass; failed or incomplete
work remains `pending-review` with the blocker. Deployment is separately verified.

Finish with the requested behavior and acceptance result, shared items changed,
the origin site's preserved adaptations,
actual checks, and remaining consumers and reasons. State whether source is
unpublished/uncommitted and whether any deployment happened. Follow repository
instructions for transferring the task diff and cleaning up its worktree.
