## Implementation

- [x] Reuse the guarded submit shortcut across registry forms and preserve the old export.
- [x] Declare affected item dependencies and update plugin and Agents documentation.
- [x] Regenerate official distribution and verify a clean consumer install.
- [x] Exercise both modifiers, validation, failures, disabled states and portal isolation.
- [x] Run repository checks and transfer only the verified task diff to the original checkout.

## Consumer follow-up

Consumer adoption and deployment are outside this task. Recorded template and site
copies require reviewed updates after publication; their revisions are not advanced.

## Verification

- 158 unit tests and 12 focused browser scenarios pass.
- Formatting, lint, TypeScript, registry dependency/source checks, production build
  and strict OpenSpec validation pass.
- A fresh shadcn consumer install of the affected items passes strict TypeScript
  with the host's CSS module declaration.
- The broader editor suite's final Blog publication assertion also fails with its
  unchanged baseline test. Draft saving and all shortcut-specific checks pass;
  the publication assertion is outside this change.
