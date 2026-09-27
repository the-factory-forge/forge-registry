import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { matchesTableSearch, TableSearch } from "@/components/table-search";
import {
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function SearchableTable({ title, rows }: { title: string; rows: string[][] }) {
  const [search, setSearch] = useState("");
  const filteredRows = rows.filter((row) => matchesTableSearch(search, ...row));
  return (
    <section className={tablePanelClass} aria-label={title}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <TableSearch
            value={search}
            onValueChange={setSearch}
            label={`Search ${title.toLowerCase()}`}
          />
          <button
            type="button"
            className="h-8 rounded-2xl bg-primary px-3 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
              <th scope="col" className={tableHeaderClass}>
                Name
              </th>
              <th scope="col" className={tableHeaderClass}>
                Details
              </th>
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
        <header>
          <h1 className="text-2xl font-semibold">Table search</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Click or focus a search icon. Each table keeps its own filter. Escape clears the focused
            search.
          </p>
        </header>
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
            ["Studio website", "Production"],
            ["Customer portal", "Under construction"],
            ["Café menu", "Requested"],
          ]}
        />
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/table-search")({ component: TableSearchExample });
