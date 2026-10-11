# Registry source releases

`VERSION` is the next **local candidate**, initially `1.0.0-rc.1`. This setup has
not published a release or tag. Before publishing, inspect canonical remote
history and adjust the candidate if necessary. Legacy framework tags and the
private package version are not proof of a Factory release baseline. Preserve
legacy tags. Recommend `1.0.0` after the supported contract and checks are ready.

Follow the shared [release policy](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/workflows/release-source.md) and [requirements](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/source-releases/spec.md).
Locate the actual `forge-spec` checkout by its remote for unpublished/local policy;
report missing policy rather than invent it. This repository owns its version
sequence independently from the other source repository.

## Prepare and check

Invoke `$release-registry` from this repository; see
[the release skill](../../.agents/skills/release-registry/SKILL.md). It prepares the
candidate locally and uses existing authority for any publishing step. Neither
skill invocation nor repository write access alone authorizes remote publication.

The compatibility surface includes item exports/props and payloads, targets,
required styles, dependencies, companion APIs and host setup. A compatible UI fix
is patch, an optional prop/plugin is minor, and an incompatible prop, target or
storage contract change is major. Use the highest impact across the whole registry;
no per-plugin version numbers are introduced.

Compare previous and candidate source AND manifests, including deletions. Map each
changed file to all owning items in both manifests; recursively follow reverse
`registryDependencies` in both graphs. Include affected companions and external
package/setup changes. List unchanged items only when clarifying impact. Mixed
customer adoption is valid; a registry release is not a site-wide installed version.

Use current package scripts. Format source before `pnpm registry:sync`; inspect
final generated `public/r/` output, then run `registry:check`, `typecheck`, `check`,
relevant tests and production build. Install affected items and their dependency
closure with the repository's pinned shadcn into a disposable consumer. Verify
imports/targets, required CSS, server boundaries and affected journeys, with
companion integration checks using disposable data when needed. JSON parsing or
showroom success alone cannot pass the release gate. The first release reviews
the complete advertised manifest rather than an invented previous release.

## Review record and GitHub notes

For each candidate, update `VERSION` and `docs/releases/v<version>.md` together.
Use the initial record as the section template. It must state what/why, affected
modules and dependencies, integration breaks, migrations (including reviewed
absence), adoption checks, check evidence and remaining limitations. Capture the
chosen previous release and candidate source range; resolve the final commit SHA
only after the record and source are committed. Avoid a self-referential SHA in
the record. Link it from the GitHub Release body at the tag.

Generate notes for the explicitly chosen previous tag, then review the complete
commit diff, including direct commits. `.github/release.yml` groups existing
`breaking-change`, `enhancement` and `bug` labels with a catch-all. Labels do not
compute the version; unlabeled changes still need impact review. No duplicate
aggregate changelog, release framework or automatic publishing workflow is used.

## Authorized publication only

Prepare the exact repository, SHA, tag, notes and prerelease/latest selection for
review. Reuse explicit publishing authority covering that candidate; otherwise
stop after local preparation. Commit/push authority must cover necessary source
and tag publication too. Recheck after source changes. Never include unrelated
dirty work just to form a release.

Verify that the candidate exists remotely, that the tag resolves to its full SHA,
and that required checks ran against that source. Use GitHub draft releases and
verify the remote tag separately: `gh release create --verify-tag` checks existence,
not the intended target. Supply reviewed notes with `--notes-file`; generated notes
can first be obtained via GitHub's Generate release notes control or Release Notes
API. Preview releases require prerelease status and must not be latest. Stable
publication requires verified immutable releases under the shared policy.

On failure, inspect existing remote tag/release state before retrying. Resume only
a matching draft; stop on a conflicting tag. Read back the published SHA and assets.
Fix released source with a new version, never by moving its tag. Publishing grants
no customer update, migration, announcement or deployment authority.

## Consuming a published release

Resolve the release tag to its full commit SHA and configure the entire `@forge`
namespace to `https://raw.githubusercontent.com/the-factory-forge/forge-registry/<full-sha>/public/r/{name}.json`
in an isolated install. This also pins `@forge` dependencies; external package and
registry inputs still need recorded resolution. Verify output exists at that SHA.
Until a first release exists, label explicit commit/main consumption unreleased.
Changing a URL does not prove installed adoption. Existing customers select their
own update scope; keep their current configuration until an authorized update.
