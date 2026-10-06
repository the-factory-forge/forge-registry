# Table search

Install `@forge/table-search` with shadcn. Preview `/table-search` from the showroom homepage.
The item includes the component, matching helper, Base UI/Lucide dependencies and the shared `cn` helper.

```tsx
import { useState } from "react";
import { matchesTableSearch, TableSearch } from "@/components/table-search";

const [search, setSearch] = useState("");
const visibleRows = rows.filter((row) => matchesTableSearch(search, row.name, row.email));

<TableSearch value={search} onValueChange={setSearch} label="Search customers" />;
```

Keep state in each table instance. Place its button beside that table's primary action,
outside the horizontal scroll container. Rendering a table primitive alone does not
add or connect search: the table owner supplies searchable fields and filters its rows.
Nested toolbar groups use `max-w-full flex-wrap` so the expanded field fits narrow cards.

`TableSearchProps` exports `value`, `onValueChange`, `label`, `placeholder`, `clearLabel`,
`alwaysExpanded`, `maxLength` and `className`. Override all three labels for translated interfaces.
The helper ignores case, accents and surrounding whitespace; every word must match.
It accepts text, numbers and missing values. It does not inspect hidden fields or DOM content.

The icon expands on click or focus. An active query stays visible after blur; empty
search collapses on blur. Set `alwaysExpanded` to keep the input visible from the
first render, including after clearing or blur, without moving focus. It defaults
to `false`. The showroom homepage uses this option instead of a separate search
input. Clear and Escape reset the query, preserving input focus in both modes.
The animated container clips its contents, retains visible focus and respects reduced motion.
Both modes use a 44px height, 36px icon controls and the same input padding, without a shadow.
The collapsed control is 44px wide; it expands to 288px, capped by the available width.
Only standard host semantic colors and Tailwind utilities are required.

Customers, projects, blog administration, menu administration, both Drive tables,
employees and pricing tables use this control. Existing controlled/server search callbacks
remain host-owned, including pagination and authorization. `EmployeesPage` accepts optional
`search` and `onSearchChange`: for paginated directories, filter before pagination and
provide the filtered total. Without these props it searches the supplied rows locally.

TC installs this item into `src/components/table-search.tsx` and
`src/components/utils/table-search.ts`. Its route-specific filtering stays in TC;
each employees, customers, projects and objectives table owns its query.
Email-layout and printable contract tables do not use interactive controls.
