## Verification — 11 October 2026

Registry source based on `83520ced54bc058f08d923d0cca4f7d840a94a5e`:

- Format, lint fix, check, TypeScript, generated registry check and production build pass.
- 81 unit tests, 9 PostgreSQL/MinIO storage tests and 14 Blogs browser tests pass.
- A real shadcn install of `@forge/blogs-storage` also installs `blogs` and its declared dependencies from the locally served namespace. Every file of the two named items matches generated content exactly. The disposable consumer's original namespace is restored.
- The first install failed because the shell selected the system pnpm instead of Vite+'s managed shim. Running the same CLI with the managed PATH succeeds; no repository dependency versions changed.

L'Aspic on modified `d5cc3286c19e7933e1039527af58de289c108ad5`:

- Check and type-aware lint pass with 17 existing warnings; 27 default tests pass, with 3 opt-in integrations skipped in that default run.
- The dedicated disposable migration script separately verifies PostgreSQL persistence, preserved original content, legacy reads, authorization, safe upgrades, edited/deleted content and no reseeding.
- Its production browser journey passes with all S3 credentials blank: image selection produces a fixed, dismissible error toast; unsaved text remains intact and no image row is reserved; saving, reload, publication and unpublication still work. Keyboard dismissal and mobile/light/dark screenshots are checked.
- French labels, routes, permissions, original bundled images, legacy S3 reads and incremental migrations remain site-owned. The old local toast renderer receives error-icon support without a layout refresh.

Only `blogs` and its reverse dependency `blogs-storage` ship the changed registry files. The consumer inventory records clinic host-adapter and template installation-guide follow-ups; those repositories are unchanged. Unknown installations remain uninspected. Source remains unpublished and uncommitted. No deployment or production data operation was performed.

The exact 11-file registry diff is transferred back to its original `main` checkout. Generated JSON, check, TypeScript and 81 unit tests pass there too; existing registry lint warnings remain. The temporary worktree/branch and owned test services are removed. Other local site and shared-spec edits remain intact.

The focused OpenSpec change validates and is archived after syncing its requirement. Full strict validation reports 23 passing items and one pre-existing failure: `show-employee-website-visibility` has no delta. Its files are unchanged. The changed Plugins spec passes, the consumer YAML parses, relative links and `git diff --check` pass.
