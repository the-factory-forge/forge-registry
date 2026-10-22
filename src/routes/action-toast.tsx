import { Toast } from "@base-ui/react/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  ActionToastProvider,
  actionToastButtonClass,
  useActionToast,
} from "@/components/action-toast";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function BackgroundActionExample({ fail }: { fail: boolean }) {
  const { add, update, close } = Toast.useToastManager();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={actionToastButtonClass}
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        const id = add({
          title: "Background action",
          description: "Working…",
          type: "loading",
          timeout: 0,
          actionProps: { children: "Dismiss", disabled: true },
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
        update(id, {
          description: fail ? "The action failed. Please try again." : "Completed",
          type: fail ? "error" : "success",
          timeout: fail ? 0 : 5000,
          actionProps: { children: "Dismiss", onClick: () => close(id) },
        });
        setPending(false);
      }}
    >
      Run background action
    </button>
  );
}

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
        Save repeatedly to stack confirmations. Hover, tap the stack or press F6 to expand it. Each
        confirmation closes after five seconds, pauses while hovered or focused, and can be
        dismissed with its Close button. Form errors stay beside the form. Background actions use
        the same toast, with their status on the left and actions on the right.
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
      <BackgroundActionExample fail={fail} />
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
