import { createFileRoute } from "@tanstack/react-router";

import { CopyEmailButton } from "@/components/copy-email-button";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function CopyEmailExample() {
  const email = "alex.morgan@example.test";
  return (
    <ShowroomPreview width="narrow">
      <ShowroomIntro title="Copy email address">
        Copy the address beside the button to your clipboard.
      </ShowroomIntro>
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate text-muted-foreground">{email}</span>
        <CopyEmailButton email={email} />
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/copy-email-button")({
  head: ({ match }) =>
    showroomHead({
      title: "React email copy button demo",
      description: "Copy an email address with an accessible icon button and clipboard feedback.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: CopyEmailExample,
});
