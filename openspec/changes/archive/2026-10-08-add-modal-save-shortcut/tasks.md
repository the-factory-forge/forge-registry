## Implementation

- [x] forge-registry: Add the shared handler to existing create/edit modal forms.
- [x] forge-registry: Declare its registry dependency and document the behavior.
- [x] forge-registry: Rebuild distribution and run unit, type, lint, build and browser checks.
- [x] forge-registry: Verify a clean shadcn consumer installation.
- [x] forge-spec: Validate the shared requirement and archive the completed change.

Consumer source refreshes and deployments remain outside this task.

## Validation results

Formatting, lint fixes, registry generation/check, all 65 unit tests, type checking,
the combined check and production build passed. Existing lint and bundler warnings
remain. All four focused Chromium shortcut regressions passed, covering Drive
create/rename, employee create/edit, menu taxonomy and reservation rescheduling.
Desktop light and narrow dark dialogs were inspected. The broader Reservations
browser suite passed nine journeys and failed its unchanged homepage locator,
which expects wording removed by existing homepage edits.

The pinned shadcn CLI installed all four affected items and their shared utility
into an empty temporary consumer. Its independent dependencies installed and its
TypeScript check passed with the normal CSS import declaration. No host adapters,
customer source or deployed sites were updated.
