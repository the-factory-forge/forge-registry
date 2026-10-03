import { createFileRoute } from "@tanstack/react-router";

import { NewsletterExample } from "@/components/newsletter-example";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function NewsletterPage() {
  return (
    <ShowroomPreview width="narrow">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Newsletter Component</h1>

      <NewsletterExample />
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/newsletter")({
  head: ({ match }) =>
    showroomHead({
      title: "Newsletter signup form demo",
      description:
        "Test a reusable React newsletter signup form with email validation, accessible labels, and loading, success, and error states.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: NewsletterPage,
});
