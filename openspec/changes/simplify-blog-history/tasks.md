# Tasks

## 1. Model and storage

- [ ] 1.1 Change `saveBlogDraft` and header bounds to retain one latest draft per language, preserving no-op saves, immutable inputs and monotonic IDs/numbers; verify focused cases in `tests/blogs.test.mjs`, including ordinary repeated saves and independent languages.
- [ ] 1.2 Save a distinct draft when resuming an older publication without further edits, keeping source snapshots immutable; verify a model regression test that resumes, saves and publishes unedited historical content.
- [ ] 1.3 Remove publication truncation based on historical source and allow publication only through the current saved draft; verify model and storage tests for five-publication retention, confirmed oldest-version removal, direct historical activation rejection and ordinary no-history/list publication.
- [ ] 1.4 Reconcile origin validation, storage adapters, mock callers and any affected public types together; verify malformed inputs, unauthorized replacement, conflicts, idempotent retries, transaction rollback, actual retained row counts, projections and protected image references in `tests/blogs-storage/history.integration.mjs` and the storage suite.
- [ ] 1.5 Update the retention/publication and integration sections of `docs/blogs.md` and ADR-0009, keeping schema/readiness and image-cleanup rules; verify they describe five publications plus one draft and require no historical-data migration for this change.

## 2. Editor, history and comparison

- [ ] 2.1 Add confirmed historical replacement to the existing draft session, preserving local input on failure and invalidating consent after a conflicting refresh; verify ordinary continuation without warnings, read-only inspection, replacement cancellation, save failure and reconfirmation in the draft/history browser suites.
- [ ] 2.2 Replace parallel lanes with the chronological list and optional single draft while retaining sidebar layout, state counts, selection, read previews, action menus and authorized deletion; verify keyboard interaction, both themes, narrow screens, live-row protection and draft-deletion fallback in `tests/blog-history.browser.mjs`.
- [ ] 2.3 Preserve `BlogHistoryReader` and `history-diff.ts` behavior; run `tests/blog-history-diff.test.mjs` and browser checks for word/paragraph changes, whitespace, insertion handling, markup safety, field/image differences, unsaved draft comparison and the no-live-publication state.
- [ ] 2.4 Route history resumption through save then ordinary publication without weakening author policy, localization, image recovery, uploads/cropping, categories or editor lifecycle; verify the existing collaboration, navigation and draft browser coverage, including pending routes and obsolete client completions.
- [ ] 2.5 Reconcile translated labels, the UI sections of `docs/blogs.md`, the Blogs entry in `docs/plugins.md`, domain-only wording in `GLOSSARY.md` and the blog-history surface brief; verify no active guidance still promises independent reprise lanes or eight saved drafts, and preserve the global design system.

## 3. Showroom scenarios and options

- [ ] 3.1 Rework `loadHistoryExample` using the shared model to seed five publications and one draft in English and French for the open article; verify counts, independent localized content, reset behavior and unchanged unrelated articles through the showroom browser flow.
- [ ] 3.2 Reconcile options and help in `blogs-preview.tsx`; verify historical replacement cancel/confirm, repeated draft saves, actual comparison, History transport off, concurrent correction, missing illustrations, read-only/permission states and existing failure controls, including collapsed settings on mobile.
- [ ] 3.3 Update the showroom sections of `docs/blogs.md` to match the revised options and fixture; verify each described control is present and the obsolete four-reprise example has been removed.

## 4. Distribution and integration checks

- [ ] 4.1 Run the repository's required formatting and lint fixes, review their diff, and rebuild `public/r/` with `pnpm registry:sync`; verify only the intended Blogs files/items and dependency changes are included and no new dependency or showroom file is shipped.
- [ ] 4.2 Run `pnpm registry:check`, `pnpm typecheck`, `pnpm check` and `pnpm build`, plus the unit and relevant browser/storage suites from groups 1–3; record commands, results and any unavailable integration environment without marking skipped checks complete.
- [ ] 4.3 Install `blogs` and `blogs-storage` into a disposable consumer and typecheck its existing-contract adapter; verify generated source, complete dependencies, ordinary no-history publication and the history resume/save/publish path. Record L’Aspic/Seebach adoption as separate follow-up rather than modifying those websites or claiming deployment.
- [ ] 4.4 Review the final behavior against every scenario in this change, validate OpenSpec strictly, check documentation links and run `git diff --check`; verify existing capabilities were preserved and that only the agreed draft retention, branching and historical-return behaviors changed.

## Workflow follow-up

- After implementation review and verification, reconcile this delta into `openspec/specs/plugins/spec.md` through the normal OpenSpec completion/archive workflow.
- Customer source adoption, any database action, release publication and deployment remain separately authorized work.
