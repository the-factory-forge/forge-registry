import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ShowroomLink as Link } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const examples = [
  {
    href: "/en/faq",
    category: "Page",
    title: "FAQ",
    description: "Page hero, category filters, and keyboard-accessible questions and answers.",
  },
  {
    href: "/en/contact",
    category: "Page",
    title: "Contact",
    description: "Page hero, contact details, opening hours, social links, and an optional map.",
  },
  {
    href: "/en/legal/cgv",
    category: "Page",
    title: "Legal pages",
    description: "Terms, privacy, and legal notice with translated sections and optional dates.",
  },
  {
    href: "/en/login",
    category: "Page",
    title: "Login",
    description: "Sign-in form with password visibility, remember me, and retry after errors.",
  },
  {
    href: "/en/login#auth-controls",
    category: "Component",
    title: "Authentication controls",
    description: "Google sign-in and sign-out with shared pending, error, and retry states.",
  },
  {
    href: "/en/forgot-password",
    category: "Page",
    title: "Forgot password",
    description: "Email recovery form with unavailable, error, and confirmation states.",
  },
  {
    href: "/en/reset-password",
    category: "Page",
    title: "Reset password",
    description: "Password reset with confirmation and invalid-link handling.",
  },
  {
    href: "/en/change-password",
    category: "Page",
    title: "Change password",
    description: "Current-password verification form and onboarding page.",
  },
  {
    href: "/en/access-denied",
    category: "Page",
    title: "Access denied",
    description: "Translated access-denied page with a configurable return link.",
  },
  {
    href: "/en/employees",
    category: "Plugin",
    title: "Employees",
    description: "Create and edit users, delete accounts, and send email verification reminders.",
  },
  {
    href: "/en/blogs",
    category: "Plugin",
    title: "Blogs",
    description: "Multilingual Markdown articles, shared images, categories, and draft publishing.",
  },
  {
    href: "/en/menus",
    category: "Plugin",
    title: "Menus",
    description:
      "Translated restaurant menu with categories, dietary labels, and staff management.",
  },
  {
    href: "/en/admin/menus",
    category: "Plugin",
    title: "Menus management",
    description: "Create and edit menu items, categories, labels, and photos.",
  },
  {
    href: "/en/drive",
    category: "Plugin",
    title: "Drive",
    description: "Private file spaces for customers, projects, or any host record.",
  },
  {
    href: "/en/projects",
    category: "Plugin",
    title: "Projects",
    description: "Customer-owned projects, shared lists, Details and Drive sections.",
  },
  {
    href: "/en/customers",
    category: "Plugin",
    title: "Customers",
    description: "Customer directory, contact details, and creation with host-owned actions.",
  },
  {
    href: "/cookie-banner",
    category: "Component",
    title: "Cookie banner",
    description:
      "Cookie preferences and consent-driven analytics with independent categories and loading retries.",
  },
  {
    href: "/newsletter",
    category: "Component",
    title: "Newsletter",
    description: "Accessible signup form with loading, success, and error states.",
  },
  {
    href: "/en/intranet-sidebar",
    category: "Component",
    title: "Intranet sidebar",
    description: "Customer branding, nested navigation, profile, and responsive drawer.",
  },
  {
    href: "/en/intranet",
    category: "Layout",
    title: "Intranet shell",
    description: "Complete workspace shell with sidebar, topbar, banner, and content area.",
  },
].sort((a, b) => a.title.localeCompare(b.title, "en"));

const types = ["All", ...[...new Set(examples.map(({ category }) => category))].sort()];

function Home() {
  const [type, setType] = useState("All");

  return (
    <ShowroomPreview>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Components Showcase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore reusable components from this registry and open their dedicated pages.
        </p>
      </header>

      <fieldset className="mb-6 flex flex-wrap gap-2">
        <legend className="sr-only">Filter by type</legend>
        {types.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            onClick={() => setType(option)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              type === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5"
            }`}
          >
            {option}
          </button>
        ))}
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {examples
          .filter((example) => type === "All" || example.category === type)
          .map((example) => (
            <Link
              key={example.href}
              href={example.href}
              className="group rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-primary hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {example.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-card-foreground transition group-hover:text-primary">
                {example.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{example.description}</p>
              <p className="mt-4 text-sm font-medium text-primary">Open component →</p>
            </Link>
          ))}
      </section>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/")({ component: Home });
