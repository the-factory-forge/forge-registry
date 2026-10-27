## Implementation

- [x] forge-registry: add scoped folder menus, dialogs and upload destinations.
- [x] forge-registry: add validated directory uploads and atomic duplication with safe cleanup.
- [x] forge-registry: update the mock adapter, labels, plugin guide and manifest.
- [x] forge-registry: pass unit, storage, browser, registry, type, lint and build checks; verify a consumer install.
- [x] forge-spec: reconcile the plugin requirement and record pending consumer adoption.
- [x] Both repositories: review the merged task diff for transfer, preserving existing edits.

## Verification

- Registry: formatting, lint, typecheck, registry validation and production build pass. Lint retains existing warnings.
- Tests: 74 unit and 14 storage tests pass in the original checkout. All 25 Drive browser cases pass, including the corrected keyboard test; seven affected cases pass again after merging the concurrent root-name change.
- Distribution: the official shadcn CLI installs Drive and its storage companion in a clean consumer, which passes TypeScript checking.
- Specifications: this change passes strict validation. Whole-repository strict validation already reports 13 failed items, including long existing requirements and previously synced active deltas.
- Consumer adoption and deployment remain pending as recorded in consumers/sites.yaml.
