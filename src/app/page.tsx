import Link from "next/link";

export default function Home() {
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/newsletter"
          className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Form
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 transition group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-200">
            Newsletter
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Accessible signup form with loading, success, and error states.
          </p>
          <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Open component →
          </p>
        </Link>
      </section>

      <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400">
        More component cards can be added here as the registry grows.
      </p>
    </main>
  );
}
