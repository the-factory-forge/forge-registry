# Blogs

Blogs manages multilingual articles from private drafts to public snapshots. Read
the [integration guide](../../../../docs/blogs.md),
[Blogs requirements](../../../../openspec/specs/plugins/spec.md#requirement-blogs-plugin)
and [storage decision](../../../../concepts/adr/0009-blog-content-and-image-storage.md)
for the affected flow.

## Logic and ownership

- `admin.tsx` composes staff pages; `editor.tsx` owns article/category forms,
  save flow and navigation protection. `history.tsx` loads history on demand and
  manages reviewed publication plans. `public.tsx` renders prepared publications.
- `model.ts` owns draft/publication transitions and retention. Each language has
  one saved draft and up to five publications, including live. Saving replaces its
  draft without changing public content. Resuming history changes the editable
  draft; Save and Publish remain distinct operations.
- `permissions.ts` separates the management author from the acting editor.
  Stored authorship governs publishing/deletion; publication signatures govern
  public attribution. Legacy attribution requires explicit administrator review.
- `server/storage.server.ts` commits article, history, projections and idempotency
  results together. `projections.server.ts` backfills query data;
  `readiness.server.ts` blocks service startup on missing or stale projections.
- PostgreSQL stores text and metadata; private S3 stores images. Drafts,
  publications and retained history protect references from cleanup. `readImage`
  authorizes current public references and returns `no-store`; publication never
  makes an object's ACL public. Text-only operations work without image storage.

## Change boundaries

Article/language changes start a different draft session. Replacing a client
invalidates old asynchronous completions while preserving unsaved inputs. Follow
the guide's editor and history lifecycle before changing navigation or callbacks.
Publication validates content, translated categories, authorship and images more
strictly than draft saving.

Account renames/deletion use trusted name and retention adapters. Inspect Employees
and Agents connector callers when changing these server methods. Before adopting
persistence changes, follow the guide's backfill, readiness and rollback procedure.

## Checks

Use [model tests](../../../../tests/blogs.test.mjs),
[history diff tests](../../../../tests/blog-history-diff.test.mjs) and the affected
`tests/blog*.browser.mjs` flow. Persistence/history/image changes need the relevant
`tests/blogs-storage/` suites and [startup tests](../../../../tests/persistence/blog-startup.integration.mjs).
Inspect `src/showroom/blogs-mock.ts` alongside model/contract changes.
