import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { NativeSelect } from "@/components/native-select";
import { renderEmail, type EmailContent } from "@/components/plugins/mailing/index";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const examples: EmailContent[] = [
  {
    preview: "One more step to confirm your email address.",
    heading: "Verify your email",
    greeting: "Hello Alex,",
    paragraphs: ["Confirm your email address to keep receiving updates about your account."],
    action: { label: "Verify my email", url: "https://example.com/verify?token=demo" },
    footer: "If you weren't expecting this email, you can ignore it.",
  },
  {
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    greeting: "Hello Alex,",
    paragraphs: ["Follow the link below to choose a new password."],
    action: { label: "Reset my password", url: "https://example.com/reset?token=demo" },
    footer: "If you didn't request this change, you can ignore this email.",
  },
  {
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
    examples.map((example) => renderEmail({ brand: { name: "Maison des Alpes" }, ...example })),
  ),
);

function MailingPage() {
  const emails = Route.useLoaderData();
  const [selected, setSelected] = useState(0);
  const [plainText, setPlainText] = useState(false);
  const email = emails[selected]!;
  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample emails only. No message is sent."
      controls={
        <>
          <div className="grid gap-2">
            <label htmlFor="factory-mailing-example">Email</label>
            <NativeSelect
              id="factory-mailing-example"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {examples.map((example, index) => (
                <option key={index} value={index}>
                  {example.heading}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plainText}
              onChange={(event) => setPlainText(event.target.checked)}
            />
            Plain-text version
          </label>
        </>
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
          title="Email preview"
          sandbox=""
          srcDoc={email.html}
          className="h-[760px] w-full rounded-xl border border-border"
        />
      )}
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/mailing")({
  loader: () => getExamples(),
  head: ({ match }) =>
    showroomHead({
      title: "Mailing plugin demo",
      description: "Preview branded transactional emails and their plain-text alternatives.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: MailingPage,
});
