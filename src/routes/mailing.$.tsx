import { createFileRoute, Link, notFound, useHydrated } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { useState } from "react";
import { z } from "zod";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/accordion";
import { NativeSelect } from "@/components/native-select";
import { renderEmail } from "@/components/plugins/mailing/index";
import { mailingBrands, mailingExamples } from "@/showroom/mailing-examples";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

type MailingSearch = { brand?: "lodge" | "corner"; format?: "text" };

const getExample = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string(), brand: z.enum(["studio", "lodge", "corner"]) }))
  .handler(({ data }) => {
    const example = mailingExamples.find(({ slug }) => slug === data.slug);
    if (!example) throw notFound();
    const { logoPath, ...brand } = mailingBrands[data.brand];
    return renderEmail({
      ...example,
      brand: { ...brand, logoUrl: new URL(logoPath, getRequestUrl()).href },
    });
  });

function MailingPage() {
  const { email, selected } = Route.useLoaderData();
  const { brand = "studio", format } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hydrated = useHydrated();
  const activeGroup = mailingExamples.find(({ slug }) => slug === selected)!.group;
  const [sections, setSections] = useState({ sample: selected, open: [activeGroup] as string[] });
  // History navigation opens the current group without remounting focused links.
  if (sections.sample !== selected) setSections({ sample: selected, open: [activeGroup] });

  function updatePreview(values: MailingSearch) {
    void navigate({
      search: (previous) => ({ ...previous, ...values }),
      hash: true,
      resetScroll: false,
    });
  }

  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample messages and illustrative brand presets. Expiry times are illustrative. No message is sent."
      navigation={
        <Accordion
          type="multiple"
          value={sections.open}
          onValueChange={(open) =>
            setSections({ sample: selected, open: Array.isArray(open) ? open : [open] })
          }
          className="flex w-full flex-col gap-6"
        >
          {(["Account", "Reservations"] as const).map((group) => (
            <AccordionItem key={group} value={group} className="border-b-0">
              <AccordionTrigger className="min-h-11 items-center py-2 text-base font-semibold">
                {group}
              </AccordionTrigger>
              <AccordionContent keepMounted>
                <div className="flex flex-col items-start gap-3 pt-2">
                  {mailingExamples
                    .filter((example) => example.group === group)
                    .map((example) => (
                      <Link
                        key={example.slug}
                        to="/mailing/$"
                        params={{ _splat: example.slug }}
                        search={(previous) => previous}
                        hash={hydrated ? true : undefined}
                        resetScroll={false}
                        aria-current={example.slug === selected ? "page" : undefined}
                      >
                        {example.heading}
                      </Link>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      }
      controls={
        <>
          <label>
            Brand
            <NativeSelect
              value={brand}
              onChange={(event) => {
                const brand = event.target.value;
                updatePreview({
                  brand: brand === "lodge" || brand === "corner" ? brand : undefined,
                });
              }}
            >
              {Object.entries(mailingBrands).map(([id, definition]) => (
                <option key={id} value={id}>
                  {definition.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={format === "text"}
              onChange={(event) =>
                updatePreview({ format: event.target.checked ? "text" : undefined })
              }
            />
            Plain-text version
          </label>
        </>
      }
    >
      <ShowroomIntro title="Mailing">
        Preview account and reservation messages. Compare The Corner and fictional brands using the
        same layout, then inspect the matching plain-text version.
      </ShowroomIntro>
      {format === "text" ? (
        <pre className="min-h-[960px] rounded-xl border border-border bg-card p-6 text-sm break-words whitespace-pre-wrap text-card-foreground">
          {email.text}
        </pre>
      ) : (
        <iframe
          key={`${selected}-${brand}`}
          title="Email preview"
          sandbox=""
          srcDoc={email.html}
          className="h-[960px] w-full rounded-xl border border-border"
        />
      )}
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/mailing/$")({
  validateSearch: (search: Record<string, unknown>): MailingSearch => ({
    brand: search.brand === "lodge" || search.brand === "corner" ? search.brand : undefined,
    format: search.format === "text" ? "text" : undefined,
  }),
  loaderDeps: ({ search }): { brand: keyof typeof mailingBrands } => ({
    brand: search.brand ?? "studio",
  }),
  loader: async ({ params, deps }) => {
    const selected = params._splat || "verify-email";
    if (!mailingExamples.some(({ slug }) => slug === selected)) throw notFound();
    const email = await getExample({ data: { slug: selected, brand: deps.brand } });
    return { email, selected };
  },
  head: ({ match }) =>
    showroomHead({
      title: "Mailing plugin demo",
      description: "Preview branded transactional emails and their plain-text alternatives.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: MailingPage,
});
