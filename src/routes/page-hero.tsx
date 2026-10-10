import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHero } from "@/components/pages/page-hero";
import { ShowroomLink } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function PageHeroPreview() {
  const [eyebrow, setEyebrow] = useState(true);
  const [subtitle, setSubtitle] = useState(true);

  return (
    <ShowroomPreview
      width="full"
      navigation={
        <>
          <ShowroomLink href="/en/faq">FAQ page</ShowroomLink>
          <ShowroomLink href="/en/contact">Contact page</ShowroomLink>
        </>
      }
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={eyebrow}
              onChange={(event) => setEyebrow(event.target.checked)}
            />
            Eyebrow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitle}
              onChange={(event) => setSubtitle(event.target.checked)}
            />
            Subtitle
          </label>
        </>
      }
      notice="PageHero is the shared header used by the FAQ and Contact pages. Install it with shadcn add @forge/page-hero."
    >
      <main>
        <PageHero
          title="Page header"
          eyebrow={eyebrow ? "Help" : undefined}
          subtitle={
            subtitle ? "The shared header for FAQ, Contact, and other inner pages." : undefined
          }
          homeLabel="All components"
          homeHref="/"
          breadcrumbs={[{ label: "Page header", href: "/page-hero" }]}
          linkComponent={ShowroomLink}
        />
      </main>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/page-hero")({
  head: ({ match }) =>
    showroomHead({
      title: "Page header demo",
      description:
        "Preview the reusable React page header shared by FAQ and Contact, with breadcrumbs, a title, and optional eyebrow and subtitle.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: PageHeroPreview,
});
