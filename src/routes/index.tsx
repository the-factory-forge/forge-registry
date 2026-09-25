import { createFileRoute } from "@tanstack/react-router";
import { BoxIcon, FileTextIcon, PanelsTopLeftIcon, PlugIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { ShowroomLink as Link } from "@/showroom/routing";
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
      description: "Sign-in, sign-out, password recovery and changes, and access-denied states.",
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
      description: "Create and edit users, delete accounts, and send email verification reminders.",
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
      description:
        "Multilingual Markdown articles, shared images, categories, and draft publishing.",
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
      description:
        "Translated restaurant menu with categories, dietary labels, and staff management.",
      keywords: [
        "public menu",
        "restaurant menu",
        "manage menu",
        "menu items",
        "menu item editor",
        "menu taxonomy",
        "categories",
        "menu categories",
        "dietary labels",
        "labels",
        "photos",
      ],
    },
    {
      href: "/en/drive",
      category: "Plugin",
      title: "Drive",
      description: "Private file spaces for customers, projects, or any host record.",
      keywords: ["drive page", "drive browser", "file spaces", "folders", "files", "uploads"],
    },
    {
      href: "/en/projects",
      category: "Plugin",
      title: "Projects",
      description: "Customer-owned projects, shared lists, Details and Drive sections.",
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
      description: "Customer directory, contact details, and creation with host-owned actions.",
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
    description: string;
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
  const query = search.trim().toLowerCase();
  const visibleExamples = examples.filter(
    (example) =>
      (type === "All" || example.category === type) &&
      [example.title, ...example.keywords].some((value) => value.toLowerCase().includes(query)),
  );

  return (
    <ShowroomPreview>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Components Showcase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore reusable components from this registry and open their dedicated pages.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filter by type</legend>
          {types.map((option) => {
            const Icon = option === "All" ? null : categoryIcons[option];

            return (
              <button
                key={option}
                type="button"
                aria-pressed={type === option}
                onClick={() => setType(option)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  type === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5"
                }`}
              >
                {Icon && <Icon className="size-4" aria-hidden="true" />}
                {option}
              </button>
            );
          })}
        </fieldset>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search examples</span>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles or keywords..."
            className="w-full rounded-full border border-input bg-background py-2 pr-4 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleExamples.length === 0 && (
          <output className="col-span-full text-sm text-muted-foreground">
            No examples found.
          </output>
        )}
        {visibleExamples.map((example) => {
          const Icon = categoryIcons[example.category];

          return (
            <Link
              key={example.href}
              href={example.href}
              className="group rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-primary hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <p className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Icon className="size-4" aria-hidden="true" />
                {example.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-card-foreground transition group-hover:text-primary">
                {example.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{example.description}</p>
              <p className="mt-4 text-sm font-medium text-primary">
                Open {example.category.toLowerCase()} →
              </p>
            </Link>
          );
        })}
      </section>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/")({ component: Home });
