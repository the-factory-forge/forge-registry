# Table pagination

`@forge/table-pagination` exports `TablePagination` and `TablePaginationProps`.
Install it with `shadcn add @forge/table-pagination` and import it from
`@/components/table-pagination`. It ships with Blogs, Employees and Drive.

```tsx
<TablePagination
  summary={`${total} posts`}
  page={page}
  pageCount={Math.max(1, Math.ceil(total / pageSize))}
  label="Post pages"
  previousDisabled={page <= 1}
  nextDisabled={page * pageSize >= total}
  disabled={loading}
  onPrevious={() => setPage(page - 1)}
  onNext={() => setPage(page + 1)}
/>
```

The host owns page state, counts, filtering, fetching and boundary checks.
Translate `summary`, `label`, `previousLabel` and `nextLabel` through props.
For cursor APIs, supply `page` and omit `pageCount` and any unknown total summary.
The footer shows the current page without a fabricated total. Drive tracks visited
cursors so Previous returns one page at a time in spaces, files, trash and the
restore destination picker. Search, sort and folder changes reset cursor history.
Translate Drive's `previous` label when updating a host; `first` remains accepted
for source compatibility but is no longer used by these controls. Blogs and
Employees retain their existing page and offset contracts. Public blog links and
calendar controls are separate.

The footer aligns right and wraps the summary separately from the controls.
Buttons use 32px desktop and 40px mobile targets with semantic theme colors,
keyboard focus and native disabled behavior. Keep the footer mounted during
loading and disable unavailable actions. The page indicator announces changes.
The component uses Tailwind 4 utilities and installs `cn` and `table-styles`;
it does not depend on showroom CSS or change host data or authorization.

The [showroom example](https://registry.the-corner.io/table-pagination) includes
numbered and cursor paging plus loading, empty and error states. Regenerate the
registry and review a source install to update an existing consumer.
