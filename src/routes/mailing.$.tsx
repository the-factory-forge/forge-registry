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
import { renderEmail } from "@/components/plugins/mailing/index";
import { mailingBrand, mailingExamples } from "@/showroom/mailing-examples";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const searchSchema = z.object({ format: z.literal("text").optional().catch(undefined) });

const getExample = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(({ data }) => {
    const example = mailingExamples.find(({ slug }) => slug === data.slug);
    if (!example) throw notFound();
    return renderEmail({
      ...example,
      brand: { ...mailingBrand, logoUrl: new URL("/icon.png", getRequestUrl()).href },
    });
  });

function MailingPage() {
  const { email, selected } = Route.useLoaderData();
  const { format } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hydrated = useHydrated();
  const activeGroup = mailingExamples[selected]!.group;
  const [sections, setSections] = useState({ sample: selected, open: [activeGroup] as string[] });
  // Open the selected group on history navigation without remounting focused links.
  if (sections.sample !== selected) setSections({ sample: selected, open: [activeGroup] });
  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample emails only. No message is sent."
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
              <AccordionTrigger className="min-h-11 items-center justify-start gap-2 py-2 text-base font-semibold [&_svg]:size-5 [&_svg]:translate-y-0 [&_svg]:text-foreground">
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
                        aria-current={
                          example.slug === mailingExamples[selected]!.slug ? "page" : undefined
                        }
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
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={format === "text"}
            onChange={(event) =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  format: event.target.checked ? "text" : undefined,
                }),
                hash: true,
                resetScroll: false,
              })
            }
          />
          Plain-text version
        </label>
      }
    >
      <ShowroomIntro title="Mailing">
        A shared email layout for account access and reservation updates. Sites supply their own
        branding, copy and destinations.
      </ShowroomIntro>
      {format === "text" ? (
        <pre className="min-h-[960px] rounded-xl border border-border bg-card p-6 text-sm break-words whitespace-pre-wrap text-card-foreground">
          {email.text}
        </pre>
      ) : (
        <iframe
          key={selected}
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
  validateSearch: (search) => searchSchema.parse(search),
  loader: async ({ params }) => {
    const selected = mailingExamples.findIndex(
      (example) => example.slug === (params._splat || "verify-email"),
    );
    if (selected === -1) throw notFound();
    const email = await getExample({ data: { slug: mailingExamples[selected]!.slug } });
    return { email, selected };
  },
  head: ({ match }) =>
    showroomHead({
      title: "Mailing plugin demo",
      description: "Preview common transactional emails and their plain-text alternatives.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: MailingPage,
});
