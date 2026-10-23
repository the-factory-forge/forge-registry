# Tasks

- [x] forge-registry: Add MenuPrintPage, optional staff navigation and translated labels.
- [x] forge-registry: Add the showroom preview and discovery through the Menus homepage entry.
- [x] forge-registry: Update guides and manifest; regenerate distribution.
- [x] forge-registry: Verify visibility, locale, prices, printing failures, keyboard and mobile behavior, and A4/A5 PDFs.
- [x] forge-registry: Run formatting, lint, tests, types, build and a disposable consumer install.
- [x] forge-spec: Reconcile the plugin contract and validate OpenSpec and links.

## Verification

- forge-registry: 62 unit tests passed; all 10 existing menu browser tests and all
  3 printer browser tests passed against the production build.
- Formatting, lint fixes, registry generation/JSON check, type checking,
  `pnpm check` and production build passed. Existing unrelated accessibility
  warnings remain.
- The official shadcn CLI installed all 25 Menus/dependency files in a disposable
  consumer. Its own TypeScript check and Vite build passed without showroom imports.
- Chromium PDF checks covered A4/A5 dimensions, single-page and long menus,
  hidden items, logo loading, all size prices and independent host styles. JPY
  and KWD checks covered zero- and three-decimal currencies. Desktop light and
  mobile dark previews were visually inspected.
- The new OpenSpec change validates strictly. Repository-wide strict validation
  reports pre-existing long-requirement warnings and an existing duplicate
  Menus delta in document-plugins. Those unrelated specifications are unchanged.
- Host integrations and deployments remain opt-in; no live customer site changed.

The homepage retains the concurrent single Menus card, with a searchable Menu
printer tag and navigation to the printer. An existing touch-drag assertion was
intermittent in one combined run and passed when rerun in isolation.

The A5 orientation correction uses 210 × 148 mm landscape pages in both preview
and printing. The browser regression checks paper dimensions and that the preview
iframe shrinks after switching from A4 to A5. All 15 menu browser checks passed,
and rendered PDF checks confirmed A4 portrait and A5 landscape page dimensions.
