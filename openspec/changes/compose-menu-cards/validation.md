# Validation

Verified on 12 November 2026, including the unassigned-dishes follow-up.

- **Source:** 179 unit tests, lint, type checking and production build pass. Independent source reviews found no blocking issue.
- **Browser:** 26 menu/photo/print journeys and six notification journeys pass. They cover grouped editing, shared categories, unassigned dishes, crop/upload, publication, Web/Paper and weekly layouts on narrow/wide screens in both themes.
- **Persistence:** Menus (3), composition/migration (1), restart (1) and Drive (17) checks pass against PostgreSQL/MinIO. They cover stale snapshots, permissions, atomic deletion, files/trash/pending uploads, retry identity and public photo denial. Migration preserves existing dishes while making their category optional; legacy flat callers remain supported.
- **Distribution:** a named shadcn install of Menus, Menus Storage, Agents Menus and Action Toast compiles in a disposable host. Generated items match their source.
- **Originating site:** Terminal60 separately passes 55 unit tests, 35 intranet and 20 public browser journeys, two menu database tests and the seed test. Registry sources have not been reinstalled there.

Language-tab follow-up: all 20 menu browser tests pass, including saved translations, missing-base-name focus and keyboard tabs. Desktop/mobile screenshots were reviewed in both themes. The 179 unit tests, code checks and build pass; persistence and installation checks above were not rerun for this UI-only change.

Consumers adopting the schema need a forward migration. Google integration,
physical devices/printers and production remain untested. No deployment or object
relocation was performed.
