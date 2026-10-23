## Implementation

- [x] forge-registry: remove the public Search button and add delayed GET submission.
- [x] forge-registry: update the browser checks and Blogs guides.
- [x] forge-registry: regenerate distribution and run required checks and visual inspection.
- [x] forge-spec: reconcile the Blogs requirement and record pending consumers.
- [x] forge-spec: validate the shared specifications and transfer only task edits.

## Verification

Focused public-blog browser checks passed, covering debounce timing, one submission,
clearing, category preservation, immediate Enter, text composition and navigation
cleanup. Desktop light and mobile dark screenshots were inspected.

Formatting, lint fixes, registry generation and JSON parsing, TypeScript, combined
checks, unit tests and the production build passed in the implementation worktree.
Existing lint and bundler warnings remain. The focused OpenSpec change passes strict
validation; the full validation reports pre-existing long-requirement warnings.

Consumer installations, deployment and database/S3 integration tests are outside
this UI change. Existing public-page props and native GET submission remain compatible.
