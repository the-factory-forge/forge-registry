import Link from "next/link";

import { NewsletterExample } from "@/components/forge/forms/newsletter-example";

export default function NewsletterPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Newsletter Component
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          Back to components
        </Link>
      </div>

      <NewsletterExample />
    </main>
  );
}
