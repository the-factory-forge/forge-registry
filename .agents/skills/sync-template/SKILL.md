---
name: sync-template
description: Update the-factory-forge/forge-template from its original upstream, mugnavo/tanstarter, while preserving Forge's localized public site, optional intranet, registry integration, and deployment setup. Use for syncing this template with TanStarter or reviewing upstream starter changes. For updating a customer website from Forge Template, use sync-forge-template instead.
---

# Sync Forge Template with TanStarter

Integrate relevant changes from **https://github.com/mugnavo/tanstarter** into **the-factory-forge/forge-template**. Match the upstream foundation while retaining the Forge adaptations, unless the user explicitly requests replacing a particular adaptation.

Creating or editing this skill does not itself request an upstream sync. For a comparison-only request, inspect and report without merging. A sync request authorizes preparing and validating the local update; follow the user's existing instructions for commits, pushes, PRs, and deployment.

## Establish the destination and working state

- Confirm the checkout's origin and provenance. This workflow targets Forge Template itself. A customer site derived from it belongs to `sync-forge-template`; do not merge TanStarter directly into that site.
- Read current `AGENTS.md`, relevant `.agents/` guidance, package scripts, `.env.schema`, and prior upstream-sync records. Follow the local skill-loading instructions for concerns affected by the upstream delta. Do not read local env files or print credentials; use `vp exec varlock load --agent` for sanitized validation.
- Record the starting commit (`FORGE_START`), branch, staged/unstaged changes, and untracked files. If another merge or rebase is in progress, identify its owner before changing that state.
- Work on `codex/sync-template`, using a unique suffix if needed, or the branch explicitly requested by the user. Do not merge into `main`. With a dirty checkout, use an isolated worktree from the relevant committed state and state which uncommitted work it excludes. Do not silently stash, commit, discard, or copy secret-bearing files. If the sync depends on excluded work, resolve that dependency before integrating it.
- Capture baseline failures with the existing toolchain so later validation can distinguish regressions. Inspect lifecycle scripts before installing dependencies.

## Resolve the exact upstream target

Discover the default branch rather than assuming a saved tracking ref is current:

```sh
git ls-remote --symref https://github.com/mugnavo/tanstarter.git HEAD
```

Honor an explicit upstream branch, tag, or commit. Verify the existing `upstream` remote's URL before using it. If it points elsewhere, fetch from the canonical URL without repointing that remote or `origin`.

Fetch the verified ref and immediately resolve its immutable commit as `TARGET`; `FETCH_HEAD` changes on the next fetch. Record the source URL, ref, SHA, and fetch date. If network verification fails, identify any inspected cached revision as cached rather than claiming it is the latest.

Forge Template has already completed its genealogy merge with TanStarter. Verify this using `git merge-base "$FORGE_START" "$TARGET"`; call the result `BASE`. Check shallow/missing history before concluding that ancestry is absent. If no real common ancestor can be established, investigate the checkout/provenance and report the blocker. Do not repeat the genealogy merge, use `--allow-unrelated-histories`, or fabricate ancestry.

Review the incoming delta and its intent:

```sh
git log --oneline "$BASE..$TARGET"
git diff --stat "$BASE" "$TARGET"
git diff --name-status -M "$BASE" "$TARGET"
```

Read affected files, commits, renames, and deletions. Consult prior sync records for intentionally omitted changes: Git ancestry alone does not mean every upstream behavior was adopted. If `TARGET` is already an ancestor of the starting commit, report that fact and inspect outstanding omissions instead of creating an empty sync. An explicit older target is not automatically a downgrade; clarify the intended rollback before reverting newer work.

## Integrate with a normal merge

Read [Forge adaptations](references/forge-adaptations.md) for the affected areas before resolving them. Current user instructions and `AGENTS.md` take precedence over historical roadmap recipes. In particular, do not treat the roadmap's old blanket “ours/theirs” rules as permission to overwrite current customizations.

On the clean, dedicated sync branch:

```sh
git merge --no-ff --no-commit "$TARGET"
```

`--no-ff` keeps even a fast-forward update reviewable before a merge commit. Resolve semantic conflicts by intent, including changes Git merged cleanly. Do not use a blanket directory replacement, hard reset, `rsync --delete`, or an ancestry-only merge to claim synchronization.

- Apply fixes to their current Forge locations. Upstream's old auth/database paths now map into `src/intranet/`; inspect rename/delete conflicts rather than creating a second auth implementation.
- Reconcile manifests, scripts, workspace catalogs/overrides, and peer compatibility together. Preserve Forge-only dependencies and lifecycle requirements. Avoid downgrading a newer local dependency merely to match an upstream version; document any intentional version divergence. A general `vpr deps` upgrade is a separate scope.
- Regenerate the lockfile with the pinned package manager after reconciling manifests. Do not replace it wholesale or resolve it by copying one side. Retain the release-age policy; if it blocks a new version, report that instead of bypassing it.
- Regenerate route trees, environment types, and any affected auth schema through the repository's tools after source conflicts are resolved. Keep applied migration history intact. Review generation diffs rather than assuming generated output is harmless.
- Audit the complete result against `FORGE_START`, including staged, unstaged, and newly introduced files. Check for resurrected upstream routes, defaults, demos, duplicate adapters, and overwritten Forge guidance. Do not remove an existing demo merely because it looks disposable; retain the user's current choices.

## Validate the reconciled template

Use current package scripts and `.agents/testing.md`; do not freeze dependency versions into this skill.

- After reviewing lifecycle changes, install with the pinned toolchain (`vp install`) and validate the environment safely. Run `vpr lint` and relevant unit tests. Use `vpr check` when formatting or toolchain configuration changed.
- Run the affected public or intranet browser tests when their behavior changes. `vpr test:e2e` and `vpr test:e2e:intranet` own their production build and server lifecycle; do not run a duplicate build first. Intranet tests require an isolated disposable local database. Never infer permission to migrate a live database or send real verification emails from a code sync.
- If optional-feature boundaries, router configuration, or environment behavior changed, verify auth enabled, auth disabled with the intranet present, and the public site with `src/intranet` absent. Test removal in a temporary copy/worktree rather than deleting it from the user's active checkout. Do not copy local env files into the test copy.
- For theme or asset changes, follow the current public CSS/SSR, font, logo/favicon, locale, and mobile checks. For deployment changes, verify the affected Docker build/startup behavior with disposable resources; an entrypoint may run migrations.
- Use port 3100 for runtime tests and leave 3000 available. Do not stop an unrelated listener to free a port. Report an occupied-port constraint and follow any explicit user override.
- Check `git diff --check`, `git diff --cached --check`, and `git ls-files -u`. Review the complete diff from `FORGE_START` for preserved behavior and unexpected files. Separate existing failures, regressions, and environment-blocked checks. Resolve introduced failures before calling the update ready.

## Record and deliver

Append to the repository's existing upstream-sync record, or create `docs/upstream-sync.md` if none exists. Keep this separate from a customer site's `docs/template-sync.md` record. Include:

- Canonical upstream URL, ref, immutable target SHA, date, `FORGE_START`, and actual merge base.
- Adopted changes, Forge adaptations retained, intentional deviations, and omissions still needing attention.
- Commands/check results, environment limitations, and whether the merge is prepared, committed, or partial.

A record does not advance Git ancestry. Do not claim a completed merge while conflicts remain, required checks are unresolved, or its merge commit has not been made. If commits are not authorized, leave the resolved merge reviewable and identify the pending merge state. Do not describe a dependency-only update as a full upstream sync.

Deliver the branch/worktree, exact target, practical changes, validation, and remaining actions. Use existing authorization for any requested commit/PR workflow; a local sync alone does not authorize publishing, production migrations, or deployment.
