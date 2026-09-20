import { createFileRoute } from "@tanstack/react-router";

import { NewsletterExample } from "@/components/newsletter-example";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function NewsletterPage() {
  return (
    <ShowroomPreview width="narrow">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Newsletter Component</h1>

      <NewsletterExample />
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/newsletter")({ component: NewsletterPage });
