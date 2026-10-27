## 1. Source and distribution

- [x] 1.1 forge-registry: extract the component/helper and wire registry tables.
- [x] 1.2 forge-registry: register files/dependencies, document props and add the homepage-linked two-table example.
- [x] 1.3 forge-registry: format, lint and regenerate `public/r` through shadcn.
- [x] 1.4 tc-website: install the local generated item through shadcn, preserve adapters and restore its published namespace.

## 2. Verification

- [x] 2.1 forge-registry: run distribution, unit, type, check and build validation.
- [x] 2.2 forge-registry: verify independent queries, keyboard/clear/blur, clipped animation, themes and showroom discovery.
- [x] 2.3 tc-website: format, lint/type check, run search tests and review the live consumer.
- [x] 2.4 forge-registry: validate the OpenSpec change and record actual results.

## Validation results

### Homepage reuse follow-up

- [x] forge-registry: add optional `alwaysExpanded`, reuse TableSearch on the homepage and document the prop.
- [x] forge-registry: verify expanded and compact behavior, category filtering, clearing, keyboard use, themes and mobile layouts.
- [x] forge-registry: regenerate distribution, verify a disposable consumer install and run repository/OpenSpec checks.

Formatting, lint fixes, registry generation/check, 48 unit tests, type checking,
`pnpm check` and the production build passed. Six search/showroom browser checks
passed, including visible search after clearing/blur and the original compact
mode. The navigation test now waits for hydration before clicking its category.
Desktop/light and mobile/dark screenshots were reviewed. A disposable shadcn
consumer installed the updated item and compiled a page using `alwaysExpanded`.
Strict OpenSpec validation passed. Existing lint and bundler warnings remain.

### Original extraction

- `pnpm registry:sync`, `pnpm registry:check`, `pnpm test` (46 tests), `pnpm typecheck`, `pnpm check`, and `pnpm build` passed during validation. The final `pnpm lint:fix` rerun then found a new unrelated TS2322 error at `registry/components/plugins/reservations/public.tsx:525` (unknown rendered as ReactNode) in concurrently added reservations work. That code was left untouched. Existing accessibility/unbound-method warnings and Base UI bundling directive warnings remain.
- The selected browser suites ran 37 checks. 35 passed initially; the animation check was corrected to measure the clipped wrapper and sibling in the same frame, and passed on rerun. The existing Drive multi-upload check timed out under concurrent load and passed unchanged on an isolated rerun.
- Search verification covers independent queries, click/focus expansion, clearing, Escape, blur, homepage/category discovery, light/dark themes, and 320px layout containment.
- TC was installed with `shadcn add @forge/table-search --yes --overwrite` against the generated local endpoint. Its published namespace was restored; package/lock files and `cn` stayed unchanged. Installed component/helper contents match registry source.
- TC `pnpm format`, `pnpm lint:fix`, `pnpm lint` (including type checking), and both search tests passed. The signed-in customer page was checked live: search narrowed to one customer, Escape restored rows, and leaving the empty field collapsed it.
- `openspec validate table-search --strict --no-interactive` passed.
