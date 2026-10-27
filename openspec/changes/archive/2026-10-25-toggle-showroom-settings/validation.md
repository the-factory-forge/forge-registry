# Validation

- Formatting and lint autofix completed; the automatic diff stayed within this task.
- Registry JSON parsing, TypeScript, Vite+ check, production build and OpenSpec strict validation passed.
- All 108 unit tests and all 10 showroom browser tests passed against the production build.
- Browser regressions cover the icon-only button beside the title, hover and keyboard tooltips with Escape dismissal, pointer/keyboard toggling, active colors, preserved settings, released layout space, hidden navigation, both themes, desktop and 320px layouts. Existing tests cover full-height layouts, sticky controls, navigation and the skip link.
- Visually inspected desktop and 375px captures with settings open/closed in light/dark themes.
- Used the installed script executables directly because the global pnpm launcher returned ENOEXEC and invoking pinned pnpm through sh attempted to reinstall into the worktree's linked node_modules.
- Registry source and distribution are unchanged; consumer installation and storage suites are outside this showroom-only change.
- After transfer to the original main checkout, Vite+ check, TypeScript, registry JSON parsing, production build and all 10 showroom browser tests passed again. Existing blog-editor source/output edits and staged contents were preserved.
- Follow-up placement adjustment: moved the gear into the Preview controls heading, removed the separate toolbar and restored header-only offsets. Build, 108 unit tests and all 10 showroom browser tests passed; desktop and mobile open/closed screenshots were inspected again.
- Smartphone follow-up: below 40rem the collapsed gear shares the blog editor back row; full application layouts clear it to preserve width. Build, formatting/lint/types, 108 unit tests and 11 showroom browser tests passed. Verified alignment and clickable controls at 320px/375px, both themes, representative full-page previews and unchanged desktop placement.
- Responsive default follow-up: settings start hidden below 40rem and open at larger widths. All 12 showroom tests pass, including both sides of the 640px boundary, reload defaults, preserved visibility on resize and hydration errors. Formatting/lint/types, registry JSON parsing, production build, 108 unit tests and strict showroom spec validation pass. Inspected 375px light and 1440px dark captures.
- Mobile browser fixtures now open settings before configuring previews; touch fixtures retain tap input. Across 81 selected browser tests, 80 pass after the fixture corrections. The menu table loading-state assertion also fails against the unchanged build, with the same missing retained rows; no menu source was changed.
- After transferring the responsive default change, the original main checkout passed Vite+ check, TypeScript, registry JSON parsing, production build, strict showroom spec validation and all 12 showroom browser tests. Concurrent blog edits and staged contents were preserved.
