import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ContactPage } from "@/components/pages/page-contact";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function ContactPreview() {
  const { locale } = useShowroomParams();
  const [details, setDetails] = useState(true);
  const [map, setMap] = useState(false);
  return (
    <ShowroomPreview
      width="full"
      navigation={<ShowroomLink href={`/${locale}/faq`}>FAQ page</ShowroomLink>}
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={details}
              onChange={(e) => setDetails(e.target.checked)}
            />
            Contact details
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={map} onChange={(e) => setMap(e.target.checked)} />
            Map embed
          </label>
        </>
      }
    >
      <main>
        <ContactPage
          hero={{
            title: "Contact us",
            eyebrow: "Let's talk",
            subtitle: "Tell us what you have in mind.",
            homeLabel: "All components",
            homeHref: "/",
            breadcrumbs: [{ label: "Contact", href: `/${locale}/contact` }],
            linkComponent: ShowroomLink,
          }}
          contact={{
            title: "Visit our studio",
            address: details ? "Example Street 12, 1200 Geneva" : undefined,
            phone: details ? "+41 22 555 01 23" : undefined,
            email: details ? "hello@example.com" : undefined,
            hours: details
              ? [
                  { label: "Monday–Friday", value: "09:00–18:00" },
                  { label: "Saturday–Sunday", value: "Closed" },
                ]
              : [],
            socials: details
              ? [
                  {
                    platform: "instagram",
                    url: "https://example.com/instagram",
                    label: "Our Instagram",
                  },
                ]
              : [],
            mapsEmbed: map ? "/showroom-map.html" : undefined,
            mapsTitle: "Studio location",
            mapPlaceholder: "The location map can be added here.",
          }}
        />
      </main>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/$locale/contact")({ component: ContactPreview });
