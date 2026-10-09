## Why

Blog, employee and Drive footers duplicate pagination controls with different sizes and spacing.

## What changes

Extract `@forge/table-pagination` and use it in the existing paginated plugin tables and Drive restore picker. Keep plugin props, translations, numbered/offset paging and Drive cursor behavior compatible. Add a discoverable demo and installation guide.

## Impact

Forge Registry owns this implementation change. Affected items are Blogs, Employees and Drive, including their transitive consumers. Consumers receive the new component through a reviewed source update; this task does not deploy customer sites. Public blog links, calendar navigation and tables without pagination are excluded.
