## Implementation

- [x] forge-registry: Remove basic control cards from `src/routes/index.tsx`.
- [x] forge-registry: Update contributor guidance and affected browser tests.
- [x] forge-spec: Reconcile the discoverable showroom examples requirement in `openspec/specs/registry-distribution/spec.md`.

## Validation

- [x] forge-registry: Run formatting, lint, unit tests, type checks and build.
- [x] forge-registry: Verify homepage filters, desktop/mobile layouts and retained demo URLs.
- [x] forge-spec: Validate OpenSpec, review links and transfer only task changes.

## Results

Registry formatting, lint, type checks, JSON validation, all 71 unit tests and
the production build passed. Four focused browser tests passed, covering both
homepage filters and the retained demos. Desktop/mobile screenshots in both
themes showed no overflow. The UI detector reported no findings.

The new OpenSpec change passed strict validation. Full-repository strict
validation reported existing long-requirement warnings in other requirements
and pending changes. No registry source or installable output changed.
