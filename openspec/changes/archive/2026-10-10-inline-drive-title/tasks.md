## Implementation

- [x] forge-registry: replace breadcrumb menu with inline title editing and preserve existing permissions and rename callbacks.
- [x] forge-registry: update Drive browser regression tests and plugin guides.
- [x] forge-registry: regenerate Drive distribution and pass formatting, lint, type, build and relevant browser checks.
- [x] forge-spec: reconcile the Plugins requirement and record pending consumer adoption.
- [x] Both repositories: transfer only the task diff, verify original checkouts and clean up worktrees.

## Verification

The original registry checkout passes 9 Drive unit tests and 9 focused browser tests, including inline title editing and the existing root/folder menus. Desktop and mobile screenshots were inspected in light and dark themes. Formatting, lint fixes, generated registry validation, TypeScript, combined checks and the production build pass, with existing warnings. Every generated Drive file matches current source.

The task's strict OpenSpec validation passes. Whole-repository strict validation retains the same 13 pre-existing failures. Both original branches and staged contents were preserved; transferred changes remain uncommitted. No consumer installation, real storage integration or deployment was tested. The manifest, dependencies and transport contracts are unchanged.
