## Implementation

- [x] forge-registry: add category names to the list mapping, storage and showroom callers.
- [x] forge-registry: render the Categories column and constrain long table text.
- [x] forge-registry: update the plugin definition, guide and unit/browser checks.
- [x] forge-registry: run final checks and regenerate the distributed items.
- [x] forge-registry: verify an independent consumer installation.
- [x] forge-spec: reconcile and validate the Blogs requirement.

## Verification

- All 63 unit tests and nine blog browser tests passed, including localized categories, long text, both themes, mobile containment and deletion.
- Formatting, lint fixes, registry generation/JSON validation, type checking, combined checks and the production build passed. Eight existing accessibility warnings remain outside Blogs.
- An official shadcn install of Blogs Storage and its UI dependencies succeeded in an independent temporary consumer. Its TypeScript compilation passed, and installed/generated blog files match the source.
- Strict validation of this change passed. Full strict shared-spec validation reports existing long-requirement warnings in other contracts and active changes.
- Live consumer updates and database/S3 integration tests were outside this UI task. Custom list adapters must supply the optional category names to populate the new column.
