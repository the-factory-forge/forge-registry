import { NewsletterExample } from "@/components/newsletter-example";

export default function NewsletterPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Newsletter Component</h1>

      <NewsletterExample />
    </main>
  );
}
