import Link from "next/link";

import { NewsletterExample } from "@/components/newsletter-example";

export default function NewsletterPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Newsletter Component</h1>
        <Link
          href="/"
          className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Back to components
        </Link>
      </div>

      <NewsletterExample />
    </main>
  );
}
