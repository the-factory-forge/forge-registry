# Validation

- Registry formatting, lint and types pass; production build passes with existing dependency directive warnings.
- All 170 registry unit tests pass. Final distribution and desktop/mobile section-anchor checks pass (11 cases).
- Real shadcn 4.22.1 installation of `@forge/section-anchor` includes cn. Installed source matches, strict TypeScript passes and namespace configuration is restored.
- TC formatting and lint/type checks pass. The production Playwright journey passes for both self-service and HR profiles, including unsaved drafts, keyboard activation, reload after scrolling away, shared links and narrow layouts. Screenshots confirm titles stay below the fixed header.
- TC tests use disposable `tc_section_links_test` with the repository migrations; the older default E2E database lacks newer columns. No production services or data are changed.
- The main specification is reconciled. The Forge Specs consumer inventory records TC local adoption and no existing reverse dependencies.
- Source is uncommitted and unpublished. No release, other-site adoption or deployment is included.
