import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { renderEmail, type EmailContent } from "@/components/plugins/mailing/index";
import { ShowroomLink } from "@/showroom/routing";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const examples: (EmailContent & { slug: string })[] = [
  {
    slug: "verify-email",
    preview: "One more step to confirm your email address.",
    heading: "Verify your email",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm your email address to keep receiving updates about your account."],
    action: { label: "Verify my email", url: "https://example.com/verify?token=demo" },
    footer: "If you weren't expecting this email, you can ignore it.",
  },
  {
    slug: "reset-password",
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    greeting: "Hello Alex,",
    paragraphs: ["Follow the link below to choose a new password."],
    action: { label: "Reset my password", url: "https://example.com/reset?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
    slug: "reservation-confirmation",
    preview: "Your stay is confirmed for 16–18 October.",
    heading: "Your stay is confirmed",
    greeting: "Hello Alex,",
    paragraphs: ["Your reservation is confirmed. Here are the details of your stay."],
    details: [
      { label: "Arrival", value: "16 October 2026" },
      { label: "Departure", value: "18 October 2026" },
      { label: "Guests", value: "4" },
    ],
    action: { label: "View my reservation", url: "https://example.com/reservations" },
    footer: "Keep this email for your reservation details.",
  },
];

const getExamples = createServerFn({ method: "GET" }).handler(() =>
  Promise.all(
    examples.map((example) => renderEmail({ brand: { name: "The Corner Factory" }, ...example })),
  ),
);

function MailingPage() {
  const { email, selected } = Route.useLoaderData();
  const [plainText, setPlainText] = useState(false);
  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample emails only. No message is sent."
      navigation={
        <>
          {examples.map((example, index) => (
            <ShowroomLink
              key={example.slug}
              href={`/mailing/${example.slug}`}
              aria-current={index === selected ? "page" : undefined}
            >
              {example.heading}
            </ShowroomLink>
          ))}
        </>
      }
      controls={
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={plainText}
            onChange={(event) => setPlainText(event.target.checked)}
          />
          Plain-text version
        </label>
      }
    >
      <ShowroomIntro title="Mailing">
        A shared email layout for account access and reservation updates. Sites supply their own
        branding, copy and destinations.
      </ShowroomIntro>
      {plainText ? (
        <pre className="min-h-[760px] rounded-xl border border-border bg-card p-6 text-sm whitespace-pre-wrap text-card-foreground">
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
  loader: async ({ params }) => {
    const selected = examples.findIndex(
      (example) => example.slug === (params._splat || "verify-email"),
    );
    if (selected === -1) throw notFound();
    const emails = await getExamples();
    return { email: emails[selected]!, selected };
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
