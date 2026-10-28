# Verification

Verified locally on 2026-10-28 against implementation baseline
`1cce6342d576a548011f4d5ce69c6a70bd8570b8`. Implementation committed as `7e4e4e7`.

The owner's final decision is automatic publication retention: publishing v6
removes v1 without a warning. Resuming a publication still confirms replacement
of an existing draft. The proposal, design and delta reflect that decision.

## Checks

| Check                                                                      | Result                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `node --test tests/*.test.mjs`                                             | 130 passed                                                          |
| Blogs, history, draft, collaboration and navigation browser suites         | 77 distinct cases passed across focused runs                        |
| `pnpm test:blogs-storage` equivalent                                       | 31 passed against dedicated local PostgreSQL/MinIO                  |
| `node --test tests/persistence/blog-startup.integration.mjs`               | 2 passed in a disposable database                                   |
| `pnpm registry:check`, `pnpm typecheck`, `pnpm check`, `pnpm format:check` | Passed                                                              |
| `pnpm registry:sync` equivalent                                            | Only `blogs.json` and `blogs-storage.json` changed                  |
| `pnpm build` equivalent                                                    | Passed; dependency bundling reports `use client` directive warnings |
| OpenSpec strict validation                                                 | Passed with no issues                                               |
| Relative documentation links and `git diff --check`                        | Passed                                                              |

One browser case encountered a reload during a development-server run; its
isolated rerun passed. Earlier obsolete assertions were updated for the new
retention and replacement behavior. No check remains skipped in the task list.

## Installed consumer

Installed `@forge/blogs` and `@forge/blogs-storage` with the pinned shadcn CLI
into `/private/tmp/forge-simplified-history-consumer`. The 45 generated files
and existing-contract adapter typecheck with explicit Node types for server code.

The installed storage implementation passed real PostgreSQL flows in a disposable
schema: ordinary publication without history controls through v6, retention of
five publications, then an unedited historical resume/save/publish. The new draft
kept its identity and newer publications remained retained. No dependency or
schema migration was added by this change.

## Standards

The independent reviewer found no actionable documented-standard breach or code
smell requiring another abstraction. Existing components, semantic tokens,
translated labels and service validation/authorization/transaction boundaries
remain in place. This axis was a static review.

## Spec

The independent reviewer found no actionable mismatch with the agreed delta,
including the owner's final automatic-pruning decision. The real comparator,
client replacement isolation and save/navigation guards remain in place.

## Interface and simplicity

Impeccable review inspected six captures: the list at 1440/390 pixels in light
and dark themes, plus replacement dialogs at both widths. All six retained rows
fit without horizontal overflow. Keyboard actions and comparison passed browser
checks. The active design hook reported no deterministic issue; no additional
manual detector pass was added. Global design and existing sidecar drift remain
unchanged.

Ponytail review kept the existing model and editor, removed branch geometry and
introduced no dependency or generic versioning layer. Legacy provenance fields
remain inert for source compatibility.

## Follow-up boundaries

L’Aspic and Seebach source adoption, release publication, database actions and
deployment remain separate work. These local checks establish no deployed state.
The rules are integrated into `openspec/specs/plugins/spec.md`.

## Owner feedback 14–17

Drafts now display Draft/Brouillon throughout the editor, reader and actions.
Publication labels use the existing publication counter; snapshot allocation stays
internal. Three changed saves after v22 publish as v23. Reactivating an unchanged
publication retains its number. No schema or dependency change was needed.

Read and Compare are explicit modes. The comparison heading identifies both
endpoints, including unsaved drafts. Title, slug and summary differences remain
visible alongside previous fields; a translated hint explains hidden unchanged
fields. Four further captures verified 1440/390 pixels in both themes without
overflow.

The follow-up reran the 130 unit tests, 31 storage tests, history/draft/editor
browser suites, type checking, formatting/lint, registry generation and build.
The controlled test fixture applies client replacements synchronously and the
obsolete-plan test waits for the replacement client’s read before releasing the
old response. This verifies obsolete completions without relying on React render
timing.

A real shadcn reinstall and consumer typecheck passed. The installed storage
passed three draft saves per publication through v6, then historical resumption
and publication as v7 using a disposable PostgreSQL schema.

The second Standards and Spec reviews each found zero actionable issues. The
scoped architecture review found no worthwhile deepening candidate: the existing
model is shared by PostgreSQL and showroom adapters, the draft session owns its
confirmation lifecycle, and the label helper centralizes the presentation rule.
No extra interface, generic confirmation hook or versioning module was added.
The HTML architecture report is local review output outside the repository.

## Owner feedback on colors and complete translations

Comparison endpoints, changed metadata and Markdown rows now share the existing
removed/added semantic colors. Minus/plus markers and accessible descriptions
retain meaning without color. Title, slug and summary use stacked before/after
rows; the diff algorithm, image comparisons and history behavior are unchanged.

Complete FR/DE/IT label dictionaries and crop-dialog overrides live in the
showroom. English reuses the portable defaults. Admin navigation retains its
interface locale independently of the demo’s EN/FR article content. Fields,
statuses, errors, save feedback, Read/Compare, replacement/crop dialogs and public
errors passed the three localized browser flows. Shared developer controls keep
their existing English labels.

This follow-up passed 130 unit tests and 45 distinct Blogs/history browser cases
across focused runs. Old expectations for English text on French pages were
updated. New navigation tests wait for the existing preview-ready marker after
the native Back link reloads the document, before operating showroom controls.

One batched Impeccable finish review covered 1440/390 pixels in light/dark. A long
slug wrapped without overflow; endpoint contrast was 6.48–10.73:1. All four
captures were inspected, with no correction round needed. Global design tokens
and the stale design sidecar remain untouched.

Formatting/lint, typecheck, registry validation/generation, production build,
strict OpenSpec validation, relative documentation links and `git diff --check`
passed. Only `public/r/blogs.json` changed relative to the prior feedback state;
no dictionary, dependency or showroom code ships in the item. A pinned shadcn
reinstall updated the consumer’s history source, and its adapter typecheck passed.

Standards and Spec reviewers both identified the same remaining public error
literal; it was corrected and covered in FR/DE/IT. Each axis then confirmed zero
remaining findings. The architecture follow-up found no worthwhile extraction:
local tone constants and a typed showroom data module reuse the existing label
interface. No additional framework, storage change or refactor was introduced.

The storage and editor-client lifecycle suites were not rerun for this styling
and label-only follow-up; their earlier results above still apply to unchanged
code. Customer adoption and deployment remain unperformed.

## Owner feedback on comparison block labels

All nine metadata field types already use visible labels, including signature,
categories, both images and their alternative text. Markdown now has a matching
visible heading that also names its accessible section, using the existing label.
Read/comparison behavior and the diff calculation remain unchanged.

The eight focused comparison/localization browser cases and 130 unit tests
passed, as did formatting/lint, typecheck, build, registry generation/validation
and strict OpenSpec validation. Desktop/mobile captures in both themes and a
bounded scroll confirmation verified the label is readable without overflow.
A real consumer reinstall updated only the history source and typechecked.
Storage suites were not rerun for this presentation-only follow-up.
