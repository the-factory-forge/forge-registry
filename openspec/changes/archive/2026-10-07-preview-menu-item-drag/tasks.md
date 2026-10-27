# Implementation

- [x] forge-registry: add floating drag feedback and matching insertion-edge behavior to MenuItemsPage.
- [x] forge-registry: document the behavior and extend the existing browser checks.
- [x] forge-registry: format/lint, regenerate distribution, run repository and browser checks, inspect desktop/mobile feedback and verify a disposable consumer install.
- [x] forge-spec: validate and reconcile the Plugins drag-feedback requirement.

## Verification evidence

- All 62 unit tests and all 10 production Menus browser tests passed. Drag checks cover mouse/touch, both insertion edges, cancellation, invalid/source drops, keyboard ordering, search gating and failed-save recovery.
- Formatting, lint fixes, registry generation/JSON check, type checking, combined checks and the production build passed. Eight existing lint warnings remain outside Menus.
- Desktop and mobile drag feedback was inspected in both themes with reduced motion. The preview stays within the viewport, permits pointer hit testing and uses the host's semantic colors. Dark mode uses a border to distinguish the preview.
- Official shadcn installation created the Menus item and dependencies in a disposable consumer. All nine Menus files match the generated item, and the consumer's independent TypeScript check passed. Its temporary registry URL was restored.
- Strict OpenSpec validation passed. The added requirement is reconciled into the main Plugins spec. Existing consumers require a source refresh; no migration or deployment was performed.
