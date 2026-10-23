# Blog draft-save adoption

This registry refactor replaces the exported `saveArticle` and `recordBlogSave`
helpers with `saveBlogDraft` in `plugins/blogs/model.ts`. `BlogsClient.save` keeps
its existing input and article result. Publication, authorization, history
retention and storage rules are unchanged.

Source status: unpublished change based on registry commit
`65a71afb3d14ce284d1967c78cd238d063b187ba`. That base does not contain the refactor.
Resolve the eventual release to its verified full SHA before a remote install.
Site upgrades, live migrations and deployment are separate follow-ups.

## Update model and adapter together

`@forge/blogs` ships `model.ts`; `@forge/blogs-storage` ships the calling adapter
and depends on Blogs. Installing only Blogs can leave an older adapter importing
the retired helpers. Reconcile both items and custom model callers in the same
consumer change, following [sync-from-forge-registry](../.agents/skills/sync-from-forge-registry/SKILL.md).
Preserve host routes, authorization, translations and source adaptations.

The single pure operation returns `{ article, saved, removedIds }`:

```ts
const result = saveBlogDraft(article, input, {
  categories,
  assets, // Set of ready image IDs owned by this article
  revisionId,
  editor, // Trusted identity resolved by the adapter
  now,
  maxBytes,
  headers,
  source,
});
```

Load history headers and the selected source in the adapter. The source is
`input.origin.versionId` when resuming history, otherwise the language's current
history version, or `null` if none exists. Headers are sufficient for retention;
only the selected source needs its full content. Keep legacy history seeding
before this operation. The adapter still resolves authors, checks permissions and
concurrency, allocates IDs/time, validates slug uniqueness and applies the result.

Persist `result.article`, `result.saved` when non-null, and `result.removedIds`
with projections and the retry result in the existing transaction. An unchanged
save returns the original article, no snapshot and no removals. Do not discard
the history result or supply empty headers for an existing history: the article
contains references and counters that must agree with stored snapshots.

Existing current-schema installations need no database migration for this
refactor. Older installations adopting history or the current Drizzle companion
must follow [persistence adoption](./persistence.md#existing-host-cutover), including
reviewed additive migrations, stopped writers, history/projection backfills and
startup checks. Source installation does not migrate data.

## Pending consumer upgrades

Inspection on 2026-10-23 found two recorded Blogs consumers. Neither accessible
checkout has history types or storage. Keep its existing installation intact
until its coordinated upgrade is reviewed; renaming its old save helper alone
does not adopt the new module.

| Consumer | Inspected source                           | Required follow-up                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L’Aspic  | `ff31f79f3ec3219b7a557aba2fe1ba81d6641811` | Reconcile `src/intranet/components/forge/plugins/blogs/` with its storage adapter. Migrate the direct model call in `src/intranet/blogs/ownership.test.ts`; retain its creator-preservation assertion, custom immutable `creatorId`, legacy Markdown hydration and bundled-image access. Review history/authorship adoption against those host rules.       |
| Seebach  | `f1658fe6f55157733cef0171ac361cc5a4a37384` | Obtain and review the newer source recorded by the consumer inventory (`b9a57f39f81b82cfa8031c01540fc3d844dc9835`), unavailable locally during this task. Reconcile installed `src/intranet/components/forge/blogs/`, its storage adapter and host `src/intranet/blogs/` integration, preserving clinical translations and newer collaboration adaptations. |

The template does not install Blogs. Consumers outside the maintained inventory
remain uninspected. Record each actual adoption separately in
`forge-spec/consumers/sites.yaml`; a registry change is not proof of deployment.

## Verify adoption

- Search installed and host source for both retired exports, including tests.
- Check saves and reloads, unchanged saves, locale isolation, history retention,
  resume/publish, stale versions, retries and authorization failures.
- Confirm article, history and projections commit or roll back together; retain
  image references and verify cleanup against retained history.
- Run consumer checks and browser journeys, and review generated distribution
  through a disposable shadcn install before adopting the release.
