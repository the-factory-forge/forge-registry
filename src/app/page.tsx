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
    description: "Create and edit users, manage access, and send email verification reminders.",
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
];

const types = ["All", ...new Set(examples.map(({ category }) => category))];

export default function Home() {
  const [type, setType] = useState("All");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col p-6 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Components Showcase
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
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
            className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              type === option
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
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
              className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {example.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950 transition group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-200">
                {example.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{example.description}</p>
              <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Open component →
              </p>
            </Link>
          ))}
      </section>
    </main>
  );
}
