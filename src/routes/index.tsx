import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useRef } from "react";

import { TableSearch } from "@/components/table-search";
import { categoryIcons, examples, type Category } from "@/showroom/examples";
import { ShowroomLink as Link } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const types: (Category | "All")[] = [
  "All",
  ...[...new Set(examples.map(({ category }) => category))].sort(),
];

function Home() {
  const { category, search = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const type = types.find((option) => option === category) ?? "All";
  const allFilterRef = useRef<HTMLButtonElement>(null);
  const query = search.trim().toLowerCase();
  const visibleExamples = examples.filter(
    (example) =>
      (type === "All" || example.category === type) &&
      [example.title, ...(example.tags ?? []), ...example.keywords].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );

  function updateFilters(filters: { category?: Category; search?: string }) {
    void navigate({
      search: (previous) => ({ ...previous, ...filters }),
      replace: true,
      resetScroll: false,
    });
  }

  return (
    <ShowroomPreview>
      <header className="max-w-3xl pt-4 pb-8 sm:pt-8 sm:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Components Showcase
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
          Preview reusable React components, page layouts, and intranet plugins. Install editable
          source in your project through the Forge shadcn registry.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border/70 py-4">
        <fieldset className="flex min-w-0 flex-wrap gap-2">
          <legend className="sr-only">Filter by type</legend>
          {types.map((option) => {
            const Icon = option === "All" ? null : categoryIcons[option];

            return (
              <button
                key={option}
                ref={option === "All" ? allFilterRef : undefined}
                type="button"
                aria-pressed={type === option}
                onClick={() => updateFilters({ category: option === "All" ? undefined : option })}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                  type === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent bg-background text-muted-foreground hover:border-border hover:bg-primary/5 hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="size-4" aria-hidden="true" />}
                {option}
                <span aria-hidden="true" className="text-xs tabular-nums opacity-80">
                  {option === "All"
                    ? examples.length
                    : examples.filter((example) => example.category === option).length}
                </span>
              </button>
            );
          })}
        </fieldset>
        <TableSearch
          value={search}
          onValueChange={(value) => updateFilters({ search: value || undefined })}
          label="Search examples"
          placeholder="Search titles or keywords..."
          alwaysExpanded
          size="default"
          className="w-full sm:w-72"
        />
      </div>

      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-4">
        <output aria-atomic="true" className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{visibleExamples.length}</span>
          {" of "}
          {examples.length} examples
        </output>
        {(type !== "All" || search) && (
          <button
            type="button"
            onClick={() => {
              updateFilters({ category: undefined, search: undefined });
              allFilterRef.current?.focus();
            }}
            className="min-h-9 cursor-pointer rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 hover:bg-primary/5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Reset filters
          </button>
        )}
      </div>

      <section aria-label="Examples" className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-3">
        {visibleExamples.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <SearchIcon className="mx-auto mb-4 size-6 text-muted-foreground" aria-hidden="true" />
            <output className="block text-lg font-semibold text-foreground">
              No examples found.
            </output>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another keyword or reset the filters to see all examples.
            </p>
          </div>
        )}
        {visibleExamples.map((example) => {
          const Icon = example.icon ?? categoryIcons[example.category];

          return (
            <Link
              key={example.href}
              href={example.href}
              className="group flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-5 text-card-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-3 text-lg font-semibold text-card-foreground group-hover:text-primary">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  {example.title}
                </h2>
                <span className="rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium text-muted-foreground">
                  {example.category}
                </span>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                {example.description}
              </p>
              {example.tags && (
                <ul
                  aria-label={`Included in ${example.title}`}
                  className="mt-4 flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                >
                  {example.tags.map((tag) => (
                    <li
                      key={tag}
                      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Open {example.category.toLowerCase()}{" "}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus:translate-x-1"
                />
              </p>
            </Link>
          );
        })}
      </section>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/")({
  head: ({ match }) =>
    showroomHead({
      title: "Reusable React components and plugins",
      description:
        "Explore React components, page layouts, and intranet plugins from The Corner Factory. Preview demos and install editable source through shadcn.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: Home,
});
