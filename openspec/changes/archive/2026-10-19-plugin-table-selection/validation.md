# Validation

The registry changes add selection to Customers, Projects (including embedded
customer lists), Employees, Blogs, Menu items and Drive files/trash. Existing
Auth selection is preserved. Drive spaces and calendar date grids have no row
delete operation and remain outside this change.

## Checks

- Pinned pnpm formatting, lint fixes, typecheck, registry generation, JSON validation,
  combined check and production build pass. Existing lint warnings remain.
- All 88 unit tests pass. Dependency assertions include the new shared helper.
- All 14 focused production-browser tests pass: mixed/all/none selection, keyboard
  tooltip access, cancellation, duplicate protection, loading locks, permission and
  sorting resets, successful batches, partial failures, stable Blog request IDs,
  employee self-protection, linked-file restrictions, Drive preview failures,
  interrupted permanent deletion, preview retry and Undo.
- The broader affected browser run covered 105 existing/new journeys. Seven
  failures caused by changed column selectors or the temporary Undo overlay were
  corrected and their focused reruns pass. Two failures also reproduce in the
  original checkout before transfer: Drive navigation cannot rediscover Assets
  after visiting its linked project, and the standalone pagination demo shifts its
  footer on a mobile error message. Those unrelated failures are unchanged.
- Desktop/mobile selection and confirmation states were checked in both themes.
  Drive preview/error space is reserved; a paused-clock check confirms that the
  action row stays at the same vertical position when previews arrive. The design
  detector reports no findings for the changed UI sources.
- The pinned shadcn CLI installed all six affected plugins and their dependency
  closure into a disposable consumer from the generated local namespace. Strict
  TypeScript passes with the existing ES2023 baseline. Installed shared helper
  source matches the registry; generated item files match their source.
- The new OpenSpec delta passes strict validation. Full strict validation retains
  the same 15 pre-existing failing specifications/changes, principally overlong
  requirement warnings; this change adds no failure.

## Consumer boundaries

Recorded Employees, Customers, Blogs, Menus and Drive adapters were inspected in
forge-template, L'Aspic, Osthoepathie Seebach, SiniGest, Soleva and Terminal60.
Their existing deletion, invalidation, request-ID and scoped-storage callbacks
remain the integration boundary. Follow-ups are recorded in consumers/sites.yaml.
No consumer source, database, live storage or deployment was changed or tested.
Unknown installations and custom TC features are not inferred to be adopters.

## Transfer

Task changes are transferred to the original branches as uncommitted edits.
Earlier Auth-selection changes and all staging are preserved. Original-checkout
verification and cleanup are tracked in tasks.md.

Original-checkout registry JSON, combined check, types and all 88 unit tests pass.
Transferred files match the verified source, original branches and staging are
unchanged, and the existing 198 lint warnings and 15 strict-spec failures remain.
