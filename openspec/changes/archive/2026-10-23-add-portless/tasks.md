## Implementation

- [x] Pin Portless, update the dev script and regenerate the lockfile.
- [x] Update setup, local consumer installation and browser testing instructions.

## Verification

- [x] Verify proxy HTTP delivery, registry JSON and the Vite WebSocket connection.
- [x] Verify the direct-port bypass.
- [x] Run formatting, lint fixes, registry checks, tests, type checks and a build.
- [x] Review the diff and report interactive HTTPS setup requirements.

## Verification results

- Chromium loaded the homepage, sidebar demo and catalog with all 59 registry
  items through a temporary HTTP proxy. Vite's WebSocket connected through the
  named URL with no browser page errors.
- `PORTLESS=0 pnpm dev` served the homepage and registry JSON directly on port 3000.
- Formatting, lint fixes, registry JSON validation, all 52 tests, TypeScript,
  `pnpm check`, the production build and strict OpenSpec validation passed.
- Nine existing accessibility lint warnings remain. The build reports upstream
  module directive warnings. No registry source changed or needed regeneration.
- Default HTTPS certificate trust was not exercised. It requires interactive
  first-run setup; verification used temporary state without system changes.
