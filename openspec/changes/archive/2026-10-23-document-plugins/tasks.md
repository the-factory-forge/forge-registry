# Implementation tasks

- [x] forge-spec: inspect shared contracts and define Plugins with each current module.
- [x] forge-spec: connect Plugins to README, AGENTS and OpenSpec context; validate links and strict OpenSpec.
- [x] forge-registry: align buttons, icons, status presentation and semantic colors across components.
- [x] forge-registry: update integration guides and generated registry items.
- [x] forge-registry: verify unit/browser journeys, theme/mobile/keyboard states and a disposable consumer.
- [x] forge-registry: run format/lint fixes, registry checks, type checking, pnpm check and production build.

Verification passed: 51 unit tests, 65 browser tests, registry generation/checks, formatting/lint fixes, type checking, pnpm check, production build and strict OpenSpec validation. Browser checks covered desktop/mobile, English/French, both themes, keyboard controls and reservation receipts/management/staff details. All changed items installed in a disposable consumer; installed source passed type checking/build and cursor, disabled-state, semantic-token and dialog checks without showroom CSS. Nine existing lint warnings remain. Server code and migrations did not change, so PostgreSQL integration tests were not repeated.
