# Shorten labels beside action icons

**P2 · Medium effort · Low risk · No dependencies**

Planned at `4ce2936`, 2026-11-22. Category — UI copy and accessibility.

On the Blog posts list, a gear already signals management. The visible name “Categories” identifies exactly where the link goes. Apply the same rule to clear plus and back-arrow controls. A screen reader must still communicate what an add button does.

## Starting point

Use a dedicated `codex/` worktree from the original branch. Record its staged, unstaged and untracked paths. The checkout already had edits in Blogs, Menus, Projects, Customers, Supports and their tests and distribution files when surveyed. Bring across the relevant working versions and record that baseline before editing. Check drift with `git diff --stat 4ce2936..HEAD -- registry/components/plugins src/showroom tests DESIGN.md docs/intranet-auth.md openspec/specs/registry-showroom/spec.md` and compare the snippets below against the working files. If a control has moved, follow its current label to its rendered element before editing.

Use the repository’s React components, Lucide icons, host label dictionaries and existing Node/Playwright browser tests. Preserve every link target, permission check, handler, accessible state and focus behavior. Leave the reviewed task diff uncommitted in the original checkout per `docs/agent-workflow.md`.

## 1. Use the category destination on the gear link

`registry/components/plugins/blogs/admin.tsx:256` renders the following children of the `categoriesHref` link, guarded by `capabilities.manageCategories`.

```text
<SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
{labels.manageCategories}
```

Render `labels.categories` as the visible link text. That existing key supplies Categories, Catégories, Kategorien and Categorie. Use the text as the link’s accessible name. The Menus item list already uses this pattern in `registry/components/plugins/menus/admin.tsx:228`.

Change the list locator in `tests/blogs.browser.mjs:239` and the blog case in `tests/taxonomy-navigation.browser.mjs:22`. Add an assertion that the visible text and accessible name match and the link opens the categories route. Check the non-admin state and at least one translated list. Preserve `labels.manageCategories` on the editor pencil in `registry/components/plugins/blogs/editor.tsx:914` and its tooltip tests. The category validation hint names that editor shortcut.

**Check.** `rg -n 'labels\.manageCategories' registry/components/plugins/blogs/{admin,editor}.tsx` should show only the pencil’s accessible name and tooltip in the editor. The permission identifier still applies in both files.

## 2. Shorten five plus-button captions

| Control                       | Current visible and accessible text | New visible text | Source                                                      |
| ----------------------------- | ----------------------------------- | ---------------- | ----------------------------------------------------------- |
| Dish sizes                    | Add size                            | Size             | `registry/components/plugins/menus/editor.tsx:548`          |
| Weekly or date-specific hours | Add interval                        | Interval         | `registry/components/plugins/reservations/settings.tsx:589` |
| Stay availability             | Add closure                         | Closure          | `registry/components/plugins/reservations/settings.tsx:741` |
| Date-specific hours           | Add date                            | Date             | `registry/components/plugins/reservations/settings.tsx:785` |
| Agent conversations           | New conversation                    | Conversation     | `registry/components/plugins/agents/index.tsx:839`          |

The Menus workspace already uses a decorative plus beside “Menu” and “Dish” in `registry/components/plugins/menus/workspace.tsx:270` and `:1635`. For example, the size editor currently renders `<PlusIcon aria-hidden="true" className="size-4 shrink-0" />` followed by `{labels.addSize}`. Put the full translated action on the button as its accessible name and the noun in its visible text. Both names must contain the same object. An exact accessible-name check alone would pass against the old UI.

Use the three plugins’ own `labels.ts` dictionaries. Keep existing full-action keys and caller overrides. Reuse a suitable noun when available. The reservation `interval` key means “Start-time interval (minutes)” and belongs to a different field. Introduce optional compact labels only where needed. A host supplying just its previous action translation must still get translated text on the button. Do not shorten a host string programmatically. Update the French reservation captions in `src/showroom/reservations-preview.tsx` to “Plage”, “Fermeture” and “Date” alongside the existing French accessible names. The Agents `untitled` label names a conversation record and remains independent.

**Check.** Extend `tests/menus.browser.mjs:1088`, `tests/reservations.browser.mjs:210` and `tests/agents.browser.mjs:253` to assert the visible caption via `innerText()` on a button located by its full accessible action. Retain the subsequent assertions for the added size, date, interval, closure or new draft. Cover an existing host override and French reservation copy. `pnpm typecheck` must pass with existing label contracts.

## 3. Name the destination beside return arrows

| Surface                                       | Default destination text                                            | Existing owners and examples                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Auth shell and password recovery              | Home, Sign in                                                       | `auth/auth-layout.tsx:76`, `auth/password-forms.tsx:177` and `:381`, `auth/password-labels.ts`                                |
| Blog create, edit, categories and public post | Posts                                                               | `blogs/admin.tsx:505` and `:634`, `blogs/editor.tsx:171`, `blogs/public.tsx:326`, `blogs/labels.ts`                           |
| Customer detail and creation                  | Customers                                                           | `customers/index.tsx:353` and `:466`, `customers/labels.ts`                                                                   |
| Project detail and creation                   | Projects or Customer projects                                       | `projects/index.tsx:370` and `:456`, `projects/labels.ts`, `src/showroom/projects-preview.tsx:99`                             |
| Menu taxonomy, item editor and print preview  | Name the actual destination, e.g. Items, Menus or the selected menu | `menus/admin.tsx:542`, `menus/editor.tsx:348`, `menus/print.tsx:232`, `menus/labels.ts`, `src/showroom/menus-preview.tsx:848` |
| Support ticket                                | Support                                                             | `supports/index.tsx:502`, `supports/labels.ts`                                                                                |

The plugin paths in this table are relative to `registry/components/plugins/`. The showroom header already uses an aria-hidden left arrow beside “All components” in `src/showroom/showroom-header.tsx:54`. Keep the existing label keys for host overrides. Update the Blog showroom’s French, German and Italian return destinations in `src/showroom/blogs-labels.ts` to “Articles”, “Beiträge” and “Articoli”. Keep the literal Blog arrow decorative, e.g. `<span aria-hidden="true">←</span>`, so the accessible name is the destination. Preserve the composed customer-project route and trace the menu preview’s `backHref` before choosing each destination. For the standalone French print route, use “Plats”.

Update the recovery-link wording in `docs/intranet-auth.md:163` and the blog row reference in `openspec/specs/registry-showroom/spec.md:124`. Record the copy convention beside the existing primary-action guidance in `DESIGN.md`. Keep independent text-only fallbacks, icon-only controls, dialog confirmations, save/submit actions and authorization identifiers.

**Check.** Locate exact-name selectors with `rg -n 'Back to (customers|customer projects|projects|posts|items|support|home|sign in)|← |Retour aux articles|Zurück zu den Beiträgen|Torna agli articoli' tests -g '*.mjs'`. Update only callers rendering a changed control. Keep locators for separately worded text-only error links. If a page has multiple identical names, scope to the relevant form or preview region and verify the target URL. Use the composed route test in `tests/projects.browser.mjs:145` as the pattern. Verify a return path with unsaved edits and a translated return link.

## Verification and handoff

1. In the isolated worktree, run `pnpm format`, `pnpm lint:fix`, then `pnpm registry:sync`. Review each change against the recorded worktree baseline. Keep generated `public/r/` entries for the affected plugins and any matching generated catalogue content.
2. Run `pnpm registry:check`, `pnpm test`, `pnpm typecheck`, `pnpm check`, `pnpm build` and `git diff --check`. Each must exit zero. Check the generated items contain the revised source. A customer adopts the copy through its usual source update.
3. Start the built showroom with `PORT=4397 HOST=127.0.0.1 pnpm start`. Set `TEST_BASE_URL=http://127.0.0.1:4397` when running `node --test` on the affected `tests/*.browser.mjs` files. Cover the localized blog lists, both category-link contexts, the five add buttons, and the return paths above at narrow and desktop widths. Assert the rendered text, role, accessible name and resulting href or UI change. Report the actual passing, failing and skipped cases. Classify any existing harness failure against the recorded baseline.
4. Review the task-only diff before transfer. This is a UI-copy change. If a shorter label would make two sibling operations indistinguishable, keep their distinguishing wording and record the case. If overlapping user edits or an untranslatable label prevent a safe change, report the affected control and retain the verified worktree.
