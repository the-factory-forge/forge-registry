## Implementation

- [x] forge-registry: add category navigation in `registry/components/plugins/menus/public.tsx`.
- [x] forge-registry: update `src/showroom/menus-preview.tsx`, `src/routes/index.tsx`, `docs/menus.md` and `registry/registry.json`.
- [x] forge-registry: add category navigation coverage in `tests/menus.browser.mjs`.
- [x] forge-registry: format, lint, regenerate endpoints, and run registry/unit/type/check/build validation.
- [x] forge-registry: run menu browser tests and inspect mobile light/dark examples.
- [x] forge-registry: install the final generated Menus item in a disposable shadcn consumer and typecheck its installed source.
- [x] forge-spec: validate, reconcile the Plugins requirement and archive with verification evidence.

## Verification

- `pnpm format`, `pnpm lint:fix`, `pnpm registry:sync`, `pnpm registry:check`, `pnpm typecheck`, `pnpm check`, `pnpm format:check` and `pnpm build` passed in forge-registry. Existing accessibility warnings remain outside Menus.
- `pnpm test` passed all 53 unit tests.
- The final production showroom at `http://127.0.0.1:3142` passed all five menu browser tests, including long category names, horizontal scrolling, French labels, keyboard jumps, filters and sticky placement.
- Mobile light/dark layouts were visually inspected. The screenshot records the selected French category in dark mode.
- The official shadcn CLI installed Menus and its dependencies into `/private/tmp/forge-menu-category-consumer`. Final generated and installed Menus files match the source, and the consumer TypeScript check passed.
- No production consumer installation or deployment was performed. Hosts adopt the item through a reviewed `@forge/menus` update and can set `--menu-top-offset` for fixed headers.
