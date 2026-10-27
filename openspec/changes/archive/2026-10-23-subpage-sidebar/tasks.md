## Implementation

- [x] Extract shared navigation while preserving intranet exports.
- [x] Add subpage sidebar and Drive folder/Trash integration.
- [x] Register source dependencies, homepage entry, example and documentation.
- [x] Verify nested navigation, folder pagination/errors, mobile focus and both themes.
- [x] Regenerate distribution and verify a disposable shadcn consumer installation.
- [x] Run repository checks and inspect the transferred task diff.
- [x] Finish visual review and record validation and consumer follow-ups.

## Validation

- The 72 unit tests pass, along with the five new sidebar browser tests. These cover
  nested navigation, folder pagination/retry, stable folder and Trash positions,
  mobile focus, both themes, homepage discovery and the existing intranet controls.
- Focused Drive checks cover loading, empty results, layout, scoped navigation,
  search, permissions, breadcrumb renaming and long names.
- Formatting, lint fixes, typecheck, combined checks, registry generation and the
  production build pass. Existing lint warnings remain. OpenSpec strict validation passes.
- A disposable consumer installed subpage-sidebar, Drive and intranet-sidebar through
  the official shadcn CLI and typechecked the installed source.
- The finish reviewer scored the loading-layout finding resolved after the fix.
  The documentation review confirmed the extension follows the existing design.
  No new palette or typography contract was introduced.
- Consumer adoption remains separate. Generated source does not update running sites.
  No storage API or database changes are included; storage integration tests were not run.
- Transferred only the task diff to the original main checkout, preserving staged
  contents and concurrent upload-toast edits. Its checks, unit tests and build pass.
