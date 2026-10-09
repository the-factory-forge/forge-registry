## Design

The controlled footer accepts optional summary and page values, translated navigation labels, callbacks and disabled states. It reuses semantic tokens, `cn` and `table-styles`, with Lucide chevrons. Numbered callers calculate their boundaries; cursor callers omit unknown totals, show the current page and retain visited cursors for Previous/Next behavior. Keep the existing Blogs Pagination adapter for source compatibility.

## Distribution and validation

Register the new file, add dependencies to Blogs, Employees and Drive, and regenerate official shadcn output. Verify a temporary consumer install, SSR rendering, browser interactions, both themes and narrow screens. Existing host adapters and authorization remain unchanged.
