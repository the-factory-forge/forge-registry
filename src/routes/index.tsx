import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BoxIcon,
  FileTextIcon,
  PanelsTopLeftIcon,
  PlugIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { TableSearch } from "@/components/table-search";
import { pluginIcons } from "@/components/utils/plugin-icons";
import { ShowroomLink as Link } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const categoryIcons = {
  Page: FileTextIcon,
  Plugin: PlugIcon,
  Component: BoxIcon,
  Layout: PanelsTopLeftIcon,
};

type Category = keyof typeof categoryIcons;

const examples = (
  [
    {
      href: "/action-toast",
      category: "Component",
      title: "Action toast",
      description:
        "Dismissible success feedback for saves and updates, without moving page content.",
      keywords: ["toast", "feedback", "save", "update", "notification"],
    },
    {
      href: "/native-select",
      category: "Component",
      title: "Native select",
      description:
        "Consistent dropdown arrow spacing with native keyboard controls and form behavior.",
      keywords: ["select", "dropdown", "arrow", "form", "control"],
    },
    {
      href: "/en/reservations",
      category: "Plugin",
      title: "Reservations",
      icon: pluginIcons.reservations,
      description:
        "Appointments and overnight stays, year and staff calendars, approval, cleaning buffers, and guest management.",
      tags: ["Public booking", "Staff calendar", "Guest management", "Booking settings"],
      keywords: [
        "reservations",
        "booking",
        "calendar",
        "appointments",
        "apartments",
        "stays",
        "hairdresser",
        "clinic",
        "cancellation",
        "scheduling",
      ],
    },
    {
      href: "/table-pagination",
      category: "Component",
      title: "Table",
      description:
        "Searchable tables with result counts, page navigation, keyboard controls, and loading states.",
      tags: ["Search", "Pagination"],
      keywords: [
        "search",
        "table",
        "filter",
        "pagination",
        "page",
        "footer",
        "employees",
        "projects",
      ],
    },
    {
      href: "/en/faq",
      category: "Page",
      title: "FAQ",
      description: "Page hero, category filters, and keyboard-accessible questions and answers.",
      keywords: [
        "faq page",
        "frequently asked questions",
        "questions",
        "answers",
        "category filters",
        "faq list",
        "page hero",
      ],
    },
    {
      href: "/en/contact",
      category: "Page",
      title: "Contact",
      description: "Page hero, contact details, opening hours, social links, and an optional map.",
      keywords: [
        "contact page",
        "contact info",
        "contact details",
        "opening hours",
        "social links",
        "map",
        "page hero",
      ],
    },
    {
      href: "/en/legal/cgv",
      category: "Page",
      title: "Legal pages",
      description: "Terms, privacy, and legal notice with translated sections and optional dates.",
      keywords: ["terms and conditions", "cgv", "privacy policy", "legal notice", "mentions"],
    },
    {
      href: "/en/auth",
      category: "Plugin",
      title: "Auth",
      icon: pluginIcons.auth,
      description: "Sign-in, sign-out, password recovery and changes, and access-denied states.",
      tags: ["Sign in", "Sign out", "Password recovery", "Password changes", "Access denied"],
      keywords: [
        "login form",
        "sign in",
        "sign out button",
        "forgot password form",
        "forgotten password",
        "reset password form",
        "change password page",
        "access denied page",
        "auth layout",
      ],
    },
    {
      href: "/en/employees",
      category: "Plugin",
      title: "Employees",
      icon: pluginIcons.employees,
      description: "Create and edit users, delete accounts, and send email verification reminders.",
      tags: ["Employee directory", "Account management", "Email verification"],
      keywords: [
        "employee list",
        "create employee",
        "edit employee",
        "delete employee",
        "email verification",
        "employee create dialog",
      ],
    },
    {
      href: "/en/blogs",
      category: "Plugin",
      title: "Blogs",
      icon: pluginIcons.blogs,
      description:
        "Multilingual Markdown articles, shared images, categories, and draft publishing.",
      tags: ["Public blog", "Post editor", "Categories", "Publishing"],
      keywords: [
        "blog index",
        "blog post",
        "manage posts",
        "new post",
        "edit post",
        "blog categories",
        "articles",
        "markdown",
        "publish",
      ],
    },
    {
      href: "/en/menus",
      category: "Plugin",
      title: "Menus",
      icon: pluginIcons.menus,
      description:
        "Translated restaurant menu with draggable item ordering, size prices, category tabs, icon badges, spice levels, allergen and dietary filters, staff management, and A4/A5 printing.",
      tags: ["Public menu", "Menu management", "Menu printer"],
      keywords: [
        "public menu",
        "restaurant menu",
        "manage menu",
        "menu items",
        "menu item editor",
        "size prices",
        "pizza sizes",
        "menu taxonomy",
        "categories",
        "menu categories",
        "dietary labels",
        "allergen filters",
        "dietary filters",
        "labels",
        "photos",
        "print menu",
        "restaurant",
        "paper",
        "A4",
        "A5",
        "PDF",
      ],
    },
    {
      href: "/en/drive",
      category: "Plugin",
      title: "Drive",
      icon: pluginIcons.drive,
      description: "Private file spaces with uploads, trash and restoration for any host record.",
      tags: ["File browser", "Folders", "Uploads", "Trash", "Restoration"],
      keywords: ["drive page", "drive browser", "file spaces", "folders", "files", "uploads"],
    },
    {
      href: "/en/projects",
      category: "Plugin",
      title: "Projects",
      icon: pluginIcons.projects,
      description: "Customer-owned projects, shared lists, Details and Drive sections.",
      tags: ["Project list", "Project details", "Assignments", "Drive integration"],
      keywords: [
        "project list",
        "project details",
        "new project",
        "project drive",
        "assignees",
        "customer projects",
      ],
    },
    {
      href: "/en/customers",
      category: "Plugin",
      title: "Customers",
      icon: pluginIcons.customers,
      description: "Customer directory, contact details, and creation with host-owned actions.",
      tags: [
        "Customer directory",
        "Contact details",
        "Customer creation",
        "Projects integration",
        "Sync integration",
      ],
      keywords: [
        "customer list",
        "customer details",
        "new customer",
        "customer projects",
        "customer sync",
      ],
    },
    {
      href: "/cookie-banner",
      category: "Component",
      title: "Cookie banner",
      description:
        "Cookie preferences and consent-driven analytics with independent categories and loading retries.",
      keywords: ["cookie preferences", "consent", "analytics", "marketing", "manage cookies"],
    },
    {
      href: "/newsletter",
      category: "Component",
      title: "Newsletter",
      description: "Accessible signup form with loading, success, and error states.",
      keywords: ["newsletter form", "signup form", "email signup"],
    },
    {
      href: "/en/intranet-sidebar",
      category: "Component",
      title: "Intranet sidebar",
      description: "Customer branding, nested navigation, profile, and responsive drawer.",
      keywords: ["navigation", "profile", "mobile drawer", "sidebar toggle"],
    },
    {
      href: "/en/intranet",
      category: "Layout",
      title: "Intranet shell",
      description: "Complete workspace shell with sidebar, topbar, banner, and content area.",
      keywords: ["workspace layout", "sidebar", "topbar", "announcement banner", "content area"],
    },
  ] satisfies {
    href: string;
    category: Category;
    title: string;
    icon?: LucideIcon;
    description: string;
    tags?: string[];
    keywords: string[];
  }[]
).sort((a, b) => a.title.localeCompare(b.title, "en"));

const types: (Category | "All")[] = [
  "All",
  ...[...new Set(examples.map(({ category }) => category))].sort(),
];

function Home() {
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const allFilterRef = useRef<HTMLButtonElement>(null);
  const query = search.trim().toLowerCase();
  const visibleExamples = examples.filter(
    (example) =>
      (type === "All" || example.category === type) &&
      [example.title, ...(example.tags ?? []), ...example.keywords].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );

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
                onClick={() => setType(option)}
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
          onValueChange={setSearch}
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
              setType("All");
              setSearch("");
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
