## Implementation

- [x] forge-registry: add and export the key helper, update `docs/reservations.md` and focused tests.
- [x] forge-registry: format source and regenerate `public/r/reservations-storage.json` with the official builder.
- [x] forge-spec: update Reservations/Plugins contracts and record ownership and consumer scope.
- [x] forge-spec: refresh the consumer inventory with source evidence and adoption status.

## Verification and handoff

- [x] forge-registry: pass required checks and the disposable PostgreSQL integration suite.
- [x] forge-registry: install the generated named item in a disposable consumer and test its server export.
- [x] forge-spec: validate the specs and record actual results and limitations.
- [x] Both repositories: transfer only this task's diff and recheck original checkouts. Temporary worktrees are removed after byte-for-byte transfer verification.
