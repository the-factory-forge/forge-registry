## Implementation

- [x] forge-registry: add selected-parent folder creation and folder ZIP downloads.
- [x] forge-registry: declare the ZIP dependency and update Drive documentation.
- [x] forge-registry: verify archive failure cases, browser interactions, formatting, lint, types and build.
- [x] forge-registry: regenerate distribution and verify a clean consumer install.
- [x] forge-spec: reconcile the Drive requirements and record consumer adoption.
- [x] Both repositories: transfer only task changes and verify the original checkouts.

## Verification

- 78 unit tests pass, including archive contents, pagination, unsafe paths, permission failures, cancellation and declared/streamed byte limits.
- All four affected Drive browser cases pass after narrowing a date-ambiguous test selector. Desktop and mobile menus were inspected in light and dark themes.
- Registry generation, JSON parsing, formatting, lint fixes, TypeScript, combined checks and the production build pass, with existing warnings.
- A fresh shadcn consumer installs Drive with fflate and passes TypeScript.
- Strict validation of this change passes. The original specification repository already has 13 failing items in whole-repository strict validation.
- Real storage CORS, maximum-size archives, consumer deployment and adoption remain unverified.

Final transfer checks: the original registry checkout passes 78 unit tests, all four affected browser tests, registry JSON validation, TypeScript, combined checks and the production build. Task source matches the verified worktree. Existing spec edits and staged contents are preserved; whole-spec validation still reports the same 13 pre-existing failing items.
