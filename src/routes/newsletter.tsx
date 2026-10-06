import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Newsletter } from "@/components/newsletter";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function NewsletterPage() {
  const [fail, setFail] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  return (
    <ShowroomPreview
      width="narrow"
      notice="Submissions are simulated. No email address is stored and no email is sent."
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simulate action failures
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(event) => setDisabled(event.target.checked)}
            />
            Disable form
          </label>
        </>
      }
    >
      <ShowroomIntro title="Newsletter">
        Try email validation, submission, and recovery from an error. Use the preview controls to
        change the form state.
      </ShowroomIntro>
      <Newsletter
        title="Studio updates"
        description="News and project notes from Acme Studio."
        buttonLabel="Subscribe"
        privacyText="Demo only. No email is sent."
        disabled={disabled}
        successMessage={successMessage}
        submitErrorMessage="Could not subscribe. Please try again."
        onSubmit={async () => {
          setSuccessMessage(undefined);
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (fail) throw new Error("Simulated subscription failure");
          setSuccessMessage("Subscription received. This demo did not store your email.");
        }}
      />
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/newsletter")({
  head: ({ match }) =>
    showroomHead({
      title: "Newsletter signup form demo",
      description:
        "Test a reusable React newsletter signup form with email validation, accessible labels, and loading, success, and error states.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: NewsletterPage,
});
