import { createFileRoute, Link, notFound, useHydrated } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { renderEmail } from "@/components/plugins/mailing/index";
import { mailingExamples } from "@/showroom/mailing-examples";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const searchSchema = z.object({ format: z.literal("text").optional().catch(undefined) });

const getExamples = createServerFn({ method: "GET" }).handler(() =>
  Promise.all(
    mailingExamples.map((example) => renderEmail({ brand: { name: "Your website" }, ...example })),
  ),
);

function MailingPage() {
  const { email, selected } = Route.useLoaderData();
  const { format } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hydrated = useHydrated();
  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample emails only. No message is sent."
      navigation={
        <>
          {mailingExamples.map((example, index) => (
            <Link
              key={example.slug}
              to="/mailing/$"
              params={{ _splat: example.slug }}
              search={(previous) => previous}
              hash={hydrated ? true : undefined}
              resetScroll={false}
              aria-current={index === selected ? "page" : undefined}
            >
              {example.heading}
            </Link>
          ))}
        </>
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
        <pre className="min-h-[760px] rounded-xl border border-border bg-card p-6 text-sm break-words whitespace-pre-wrap text-card-foreground">
          {email.text}
        </pre>
      ) : (
        <iframe
          key={selected}
          title="Email preview"
          sandbox=""
          srcDoc={email.html}
          className="h-[760px] w-full rounded-xl border border-border"
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
    const emails = await getExamples();
    return { email: emails[selected]!, selected };
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
