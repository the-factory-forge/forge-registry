---
name: release-registry
description: Prepare or publish a forge-registry source release with version-bump reasoning, reviewed GitHub notes and repository checks. Use for releasing this repository, not customer updates or deployment.
---

# Release Factory registry

Locate `forge-registry` by its canonical Git remote; read its `AGENTS.md`,
[release guide](../../../docs/releases/README.md), `VERSION`, current manifests
and scripts. Load the shared release policy from the actual `forge-spec` checkout
or the guide's canonical link. Follow the owning worktree procedure and keep
unrelated working changes out of the candidate.

1. Inspect remote tags/releases and source since the last verified release. A local
   `VERSION`, private package version or inherited tag does not establish published
   history. Select an unused candidate; explain the highest compatibility impact
   under this repository's release guide. Identify affected items, companions, shared-file owners and transitive dependents in both manifests.
2. Prepare `VERSION` and `docs/releases/v<version>.md` with the actual what/why,
   compatibility, migrations, customer checks and known limitations. Review
   generated GitHub notes against the complete source diff, including direct
   commits. Before any remote generation/draft action, check its required authority;
   local notes can be prepared without creating a GitHub Release.
3. Run the guide's current source-release checks against the candidate. Record
   passed/blocked checks, inspect the full diff and separate existing failures.
   Required failures block stable publication; never claim readiness from the
   initial preparation record. Readiness must cover the exact eventual source.
4. Identify repository, full SHA, tag, reviewed notes/assets and prerelease/latest
   choice. Use existing explicit authority for commits, pushes, tags and publication;
   otherwise finish with the local candidate and the exact pending action. Do not
   ask for routine reapproval of authorized preparation or the same authorized
   tuple. Source changes require checking authority for the changed candidate.
5. Within that authority, verify the remote tag SHA, use a matching GitHub draft,
   check immutability as required, and publish only that candidate. Read back the
   result. After ambiguous failure inspect remote state before retrying; conflicting
   tags stop the attempt. Never move/reuse a published version.

Report the release identity or unpublished candidate, checks and blockers.
Customer updates, live migrations, announcements and deployments are separate.
