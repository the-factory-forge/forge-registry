"use client";

import Link from "next/link";
import { useState } from "react";

const examples = [
  {
    href: "/en/login",
    category: "Form",
    title: "Login",
    description: "Sign-in form with password visibility, remember me, and retry after errors.",
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
    category: "Layout",
    title: "Cookie banner",
    description:
      "Cookie preferences with category controls, accept all, save selection, and reject all.",
  },
  {
    href: "/newsletter",
    category: "Form",
    title: "Newsletter",
    description: "Accessible signup form with loading, success, and error states.",
  },
  {
    href: "/en/intranet-sidebar",
    category: "Navigation",
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

export default function Home() {
  const [type, setType] = useState("All");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col p-6 sm:p-8">
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
    </main>
  );
}
