## 1. Implementation

- [x] 1.1 forge-registry: Extend Drive contracts and initial database schema.
- [x] 1.2 forge-registry: Implement guarded trash, restoration and durable expiry cleanup.
- [x] 1.3 forge-registry: Add Trash UI, conflict recovery and representative mock behavior.
- [x] 1.4 forge-registry: Update docs, manifest, homepage description and generated artifacts.
- [x] 1.5 forge-registry: Add permitted toast Undo with retry/conflict recovery and browser checks.

## 2. Verification and distribution

- [x] 2.1 forge-registry: Run unit, browser, storage and Menus guard recovery checks.
- [x] 2.2 forge-registry: Run formatting, lint, registry, type checks and production build.
- [x] 2.3 forge-registry: Review a disposable shadcn consumer install.
- [x] 2.4 forge-spec: Reconcile Plugins requirements, validate and archive after verification.

## Verification notes

Drive storage (including restart recovery), Menus storage guards, unit tests,
Drive browser recovery in desktop/mobile and both themes, project trash deletion
guards, dialog shortcuts, registry generation, type checking, combined checks,
production build and a disposable shadcn consumer install/typecheck were verified.
The existing mobile Menus photo-folder navigation test fails because its sticky
actions obscure the folder link; the unchanged original checkout reproduces it.
Existing unrelated lint warnings remain. No production migration or deployment.
