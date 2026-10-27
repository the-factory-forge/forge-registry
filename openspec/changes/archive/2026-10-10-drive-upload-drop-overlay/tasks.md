## Implementation

- [x] forge-registry: implement the drop overlay and translated guidance.
- [x] forge-registry: cover drag lifecycle and upload guards in browser checks.
- [x] forge-registry: update the Drive guide and generated endpoint.
- [x] forge-spec: record the module requirement and pending consumer adoption.

## Verification

- [x] forge-registry: run formatting, lint, registry, unit, type and build checks.
- [x] forge-registry: verify drop behavior and both themes at mobile/desktop widths.
- [x] forge-spec: validate the change, reconcile main specs and archive.

## Results

Formatting, lint, registry checks, type checks, all 72 worktree unit tests and the
production build pass. Chromium verifies the drop target at 390px and 1440px in
both themes, nested drag entry/leave, file upload, cancellation and upload guards.
The existing folder rejection and upload flow browser check also passes.

The change passes strict OpenSpec validation. Whole-repository strict validation
still reports pre-existing long requirement bodies and stale deltas. Consumer
source adoption and deployment remain pending.
