import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { NativeSelect } from "@/components/native-select";
import { TablePagination } from "@/components/table-pagination";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import {
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { ShowroomLink as Link } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const posts = [
  "Make room for better ideas",
  "A quieter kind of productivity",
  "Notes from our workbench",
  "An idea for tomorrow",
  "Working together",
  "A fresh perspective",
  "Small improvements",
];

function TablePaginationExample() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("ready");
  const [cursor, setCursor] = useState(0);
  const filteredPosts =
    state === "empty" ? [] : posts.filter((title) => matchesTableSearch(search, title));
  const total = filteredPosts.length;
  const pageCount = Math.max(1, Math.ceil(total / 3));
  return (
    <ShowroomPreview
      navigation={<Link href="/table-search">Independent table searches</Link>}
      controls={
        <div className="grid gap-2 text-sm">
          <label htmlFor="factory-pagination-state">Table state</label>
          <NativeSelect
            id="factory-pagination-state"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="ready">Ready</option>
            <option value="loading">Loading</option>
            <option value="empty">Empty</option>
            <option value="error">Error</option>
          </NativeSelect>
        </div>
      }
    >
      <div className="space-y-6">
        <ShowroomIntro title="Table search & pagination">
          Search the posts, then page through the matching results. Changing the search returns to
          the first page. Cursor paging shows the current page without a total.
        </ShowroomIntro>
        <section
          className={tablePanelClass}
          aria-label="Blog posts"
          aria-busy={state === "loading"}
        >
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Blog posts</h2>
            <TableSearch
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              label="Search blog posts"
              className="ml-auto"
            />
          </header>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={tableRowClass}>
                  <th scope="col" className={tableHeaderClass}>
                    Title
                  </th>
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr>
                    <td className={tableCellClass}>
                      <output>{state === "empty" ? "No posts." : "No matches."}</output>
                    </td>
                  </tr>
                ) : (
                  filteredPosts.slice((page - 1) * 3, page * 3).map((title) => (
                    <tr key={title} className={tableRowClass}>
                      <td className={tableCellClass}>{title}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="min-h-12 pt-2 text-sm">
            {state === "loading" && <output>Loading posts…</output>}
            {state === "error" && (
              <p role="alert" className="text-destructive">
                Could not load posts. Select Ready to retry.
              </p>
            )}
          </div>
          <TablePagination
            summary={`${total} posts`}
            page={page}
            pageCount={pageCount}
            label="Blog post pages"
            previousDisabled={page <= 1}
            nextDisabled={page >= pageCount}
            disabled={state === "loading" || state === "error"}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </section>
        <section className={tablePanelClass} aria-label="Cursor paging">
          <h2 className="font-semibold">Cursor paging</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sample batch {cursor + 1} of files. Previous returns one batch at a time, as it does in
            Drive.
          </p>
          <TablePagination
            label="File batches"
            page={cursor + 1}
            previousDisabled={cursor === 0}
            nextDisabled={cursor === 2}
            onPrevious={() => setCursor(cursor - 1)}
            onNext={() => setCursor(cursor + 1)}
          />
        </section>
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/table-pagination")({
  head: ({ match }) =>
    showroomHead({
      title: "React table search and pagination demo",
      description:
        "Try React table search and pagination together, with filtered totals, cursor navigation, keyboard controls and loading states.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: TablePaginationExample,
});
