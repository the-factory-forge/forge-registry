import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function ActionToastExample() {
  const notify = useActionToast();
  const [pending, setPending] = useState(false);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState(false);
  return (
    <ShowroomPreview
      width="narrow"
      controls={
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fail}
            onChange={(event) => setFail(event.target.checked)}
          />
          Simulate action failures
        </label>
      }
    >
      <ShowroomIntro title="Action toast">
        Save to show a confirmation. It closes after five seconds, pauses while hovered or focused,
        and can be dismissed with its Close button. Errors stay beside the form.
      </ShowroomIntro>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(false);
          await new Promise((resolve) => setTimeout(resolve, 400));
          setPending(false);
          if (fail) setError(true);
          else notify("Project updated.");
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            The action failed. Please try again.
          </p>
        )}
      </form>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/action-toast")({
  head: ({ match }) =>
    showroomHead({
      title: "React action toast demo",
      description: "Try accessible success confirmations, dismissal and inline error recovery.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: () => (
    <ActionToastProvider>
      <ActionToastExample />
    </ActionToastProvider>
  ),
});
