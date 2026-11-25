import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { matchesTableSearch, TableSearch } from "@/components/table-search";
import { TableSortHeader, useTableSort } from "@/components/table-sort";
import { sortTableRows } from "@/components/utils/table-sort-state";
import {
  tableCellClass,
  tableClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { useShowroomTableSort } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const fields = ["name", "details"] as const;
const byName = { field: "name", direction: "asc" } as const;
function SearchableTable({ title, rows }: { title: string; rows: string[][] }) {
  const [search, setSearch] = useState("");
  const key = "table-search-" + title.toLowerCase();
  const sortProps = useShowroomTableSort(title.toLowerCase(), fields);
  const order = useTableSort(sortProps, byName, undefined, { key, fields });
  const filteredRows = sortTableRows(
    rows.filter((row) => matchesTableSearch(search, ...row)),
    order.value ?? byName,
    (row, field) => row[field === "name" ? 0 : 1],
    (row) => row[0],
  );
  return (
    <section className={tablePanelClass} aria-label={title}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <TableSearch
            value={search}
            onValueChange={setSearch}
            label={`Search ${title.toLowerCase()}`}
          />
          <button
            type="button"
            className="min-h-10 cursor-pointer rounded-md bg-primary px-3 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-8"
            onClick={() => setSearch("")}
          >
            Show all
          </button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableRowClass}>
              {fields.map((field) => (
                <TableSortHeader
                  key={field}
                  field={field}
                  {...order}
                  label={field === "name" ? "Name" : "Details"}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row[0]} className={tableRowClass}>
                {row.map((value, index) => (
                  <td key={index} className={tableCellClass}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={2} className={tableCellClass}>
                  <output>No matches.</output>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableSearchExample() {
  return (
    <ShowroomPreview>
      <div className="space-y-6">
        <ShowroomIntro title="Table search">
          Open or focus a search control to filter its table. Each table keeps its own search. Press
          Escape to clear the focused search.
        </ShowroomIntro>
        <SearchableTable
          title="Employees"
          rows={[
            ["Alex Morgan", "Admin"],
            ["Sam Rivera", "Designer"],
            ["Zoë Martin", "Developer"],
          ]}
        />
        <SearchableTable
          title="Projects"
          rows={[
            ["Studio website", "Requested"],
            ["Customer portal", "Production"],
            ["Café menu", "Requested"],
          ]}
        />
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/table-search")({
  head: ({ match }) =>
    showroomHead({
      title: "React table search demo",
      description:
        "Try an expanding React table search with independent filters, accent-insensitive matching, keyboard focus, and clear actions.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: TableSearchExample,
});
