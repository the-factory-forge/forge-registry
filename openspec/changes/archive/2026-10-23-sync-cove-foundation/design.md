## Decisions

Use Cove revision `ebd3e81a9fa91ba2f4c040012e3f3925352c16bf` as the reviewed
target. Adapt its foundation without merging its application files. Preserve the
independent source distribution boundary in Forge ADR-0001.

Run the Vite+ 1.0 migrator against the original installed dependencies, with
agent, editor and hook setup disabled. Preserve the registry's lint rules,
aliases and generated-file exclusions. Remove the blanket Vitest 4 override;
Vite+ uses its own compatible runner, while the repository keeps Node tests.
Do not force Vitest 5 into Better Auth's optional peer range.
pnpm otherwise attaches Vite+'s Vitest 5 to Better Auth 1.7.2. Exclude that
version's optional Vitest peer, used only by its unimported test utilities,
with a narrow override. Revisit it when Better Auth changes.

Use Node `^24.11.0 || >=26.0.0`, Node 24 in CI and containers, and matching
Node 24 types. Keep the package-manager pin consistent with Docker. TypeScript 7
no longer exports its compiler API; Node's `stripTypeScriptTypes` can compile
both browser modules served by the Drive integration test without a dependency.

Keep auth, application database, Query, Varlock, evlog, React Compiler and
devtools outside the showroom foundation. Preserve the Node test runner and
the registry's existing theme, fonts and class-name helper. Only reservations
has exact Base UI and Lucide dependency pins that need updating in distribution.

Record the reconciled revision in `.cove.jsonc` only after verification. The
showroom guide owns the selective-sync procedure and exclusions. Shared Forge
specifications and consumer repositories need no edits.

## Verification

Compare against the existing passing unit/check/build baseline and collect a
browser baseline before replacing dependencies. Run a frozen install, all
repository checks, production and browser smoke checks, Portless and direct
startup, the disposable Drive storage suite, and a clean reservations consumer
installation. Keep existing assertions and lint protections.

The project deletion browser test now waits for the Cancel button to receive
focus before asserting it. The upgraded dialog can become visible before its
focus effect finishes. Repeated browser checks reproduced this ordering and
confirmed focus settles correctly; no component behavior or assertion changed.
