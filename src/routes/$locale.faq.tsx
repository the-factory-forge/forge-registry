import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { FaqPage } from "@/components/pages/page-faq";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const items = [
  {
    question: "How do we start?",
    answer: "Tell us about your project and we will arrange an initial conversation.",
    category: "Getting started",
  },
  {
    question: "Can we meet remotely?",
    answer: "Yes. Meetings can take place online or at our studio.",
    category: "Getting started",
  },
  {
    question: "Can I request changes?",
    answer: "Yes. We agree on the scope and review changes together before continuing.",
    category: "Working together",
  },
];

function FaqPreview() {
  const { locale } = useShowroomParams();
  const [categories, setCategories] = useState(true);
  const [empty, setEmpty] = useState(false);
  return (
    <ShowroomPreview
      width="full"
      navigation={<ShowroomLink href={`/${locale}/contact`}>Contact page</ShowroomLink>}
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={categories}
              onChange={(e) => setCategories(e.target.checked)}
            />
            Category filters
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
            Empty list
          </label>
        </>
      }
    >
      <main>
        <FaqPage
          hero={{
            title: "Frequently asked questions",
            eyebrow: "Help",
            subtitle: "Answers before we get started.",
            homeLabel: "All components",
            homeHref: "/",
            breadcrumbs: [{ label: "FAQ", href: `/${locale}/faq` }],
            linkComponent: ShowroomLink,
          }}
          faq={{
            title: "Your questions",
            eyebrow: "FAQ",
            items: empty
              ? []
              : items.map((item) => ({
                  ...item,
                  category: categories ? item.category : undefined,
                })),
          }}
        />
      </main>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/$locale/faq")({ component: FaqPreview });
