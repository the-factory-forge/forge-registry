import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { LegalPage } from "@/components/pages/page-legal";
import { ShowroomLink } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const documents = [
  {
    id: "cgv",
    title: "Terms and conditions",
    sections: [
      {
        title: "Scope",
        content: "Use this section to present the terms approved for your website.",
      },
      {
        title: "Services",
        content:
          "Describe your services and the conditions that apply to them.\nLine breaks in the supplied text are preserved.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy policy",
    sections: [
      {
        title: "Information collected",
        content: "Use this section to describe your website's actual data practices.",
      },
      { title: "Contact", content: "Example studio\nprivacy@example.test" },
    ],
  },
  {
    id: "mentions",
    title: "Legal notice",
    sections: [
      { title: "Publisher", content: "Example studio\nExample Street 12\nhello@example.test" },
      { title: "Hosting", content: "Add the hosting information that applies to your website." },
    ],
  },
];

export const Route = createFileRoute("/$locale/legal/$document")({
  loader: ({ params }) => {
    const document = documents.find((item) => item.id === params.document);
    if (!document) throw notFound();
    return document;
  },
  component: LegalPreview,
});

function LegalPreview() {
  const { locale } = Route.useParams();
  const document = Route.useLoaderData();
  const [showDate, setShowDate] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  return (
    <ShowroomPreview
      width="full"
      navigation={documents.map((item) => (
        <ShowroomLink
          key={item.id}
          href={`/${locale}/legal/${item.id}`}
          aria-current={item.id === document.id ? "page" : undefined}
        >
          {item.title}
        </ShowroomLink>
      ))}
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDate}
              onChange={(event) => setShowDate(event.target.checked)}
            />
            Last updated date
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showIntro}
              onChange={(event) => setShowIntro(event.target.checked)}
            />
            Introduction
          </label>
        </>
      }
    >
      <main>
        <LegalPage
          title={document.title}
          updatedAt={showDate ? "24 September 2026" : undefined}
          intro={
            showIntro
              ? "Example content for previewing this layout. Supply your own approved text and translations."
              : undefined
          }
          sections={document.sections}
        />
      </main>
    </ShowroomPreview>
  );
}
