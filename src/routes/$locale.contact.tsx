import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ContactPage } from "@/components/pages/page-contact";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function ContactPreview() {
  const { locale } = useShowroomParams();
  const [details, setDetails] = useState(true);
  const [map, setMap] = useState(true);
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
            title: "The Corner Factory SA",
            address: details ? "Rue de Saint-Guérin 6, 1950 Sion" : undefined,
            mapsUrl:
              "https://www.google.com/maps/place/The+Corner+Factory+SA/data=!4m2!3m1!1s0x0:0xce2ae13c0797074c",
            phone: details ? "+41 79 963 47 74" : undefined,
            email: details ? "support@the-corner.io" : undefined,
            hours: details
              ? [
                  { label: "Monday–Friday", value: "09:00–16:00" },
                  { label: "Saturday–Sunday", value: "Closed" },
                ]
              : [],
            mapsEmbed: map
              ? "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2760.0010210251744!2d7.348476000000001!3d46.2303244!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x478edd9c0ee45bab%3A0xce2ae13c0797074c!2sThe%20Corner%20Factory%20SA!5e0!3m2!1sfr!2sch!4v1791641264063!5m2!1sfr!2sch"
              : undefined,
            mapsTitle: "The Corner Factory SA location",
            mapPlaceholder: "Enable Map embed to view The Corner Factory SA in Sion.",
          }}
        />
      </main>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/$locale/contact")({
  head: ({ match }) =>
    showroomHead({
      title: "Contact page demo",
      description:
        "Explore a reusable React contact page using The Corner Factory SA's contact details, opening hours, and Google Maps location. All content is supplied by the host.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: ContactPreview,
});
