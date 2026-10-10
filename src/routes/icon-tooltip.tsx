import { Dialog } from "@base-ui/react/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const buttonClass =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

function IconTooltipExample() {
  const [edits, setEdits] = useState(0);
  return (
    <ShowroomPreview width="narrow">
      <ShowroomIntro title="Icon tooltip">
        Hover or tab to an icon for its label. Press Escape to dismiss the tooltip.
      </ShowroomIntro>
      <div className="flex flex-wrap gap-2">
        <IconTooltip label="Edit example">
          <button
            type="button"
            aria-label="Edit example"
            className={buttonClass}
            onClick={() => setEdits(edits + 1)}
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </button>
        </IconTooltip>
        <IconTooltip label="Open pagination example">
          <a href="/table-pagination" aria-label="Open pagination example" className={buttonClass}>
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </a>
        </IconTooltip>
        <IconTooltip label="Delete unavailable example">
          <button
            type="button"
            aria-label="Delete unavailable example"
            disabled
            className={buttonClass}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
          </button>
        </IconTooltip>
        <Dialog.Root>
          <IconTooltip label="Delete example">
            <Dialog.Trigger aria-label="Delete example" className={buttonClass}>
              <Trash2Icon className="size-4" aria-hidden="true" />
            </Dialog.Trigger>
          </IconTooltip>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
            <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl bg-popover p-6 text-popover-foreground shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <Dialog.Title className="text-lg font-semibold">Delete example</Dialog.Title>
                <IconTooltip label="Close confirmation">
                  <Dialog.Close aria-label="Close confirmation" className={buttonClass}>
                    <XIcon className="size-4" aria-hidden="true" />
                  </Dialog.Close>
                </IconTooltip>
              </div>
              <Dialog.Description>
                This demo preserves the confirmation before a destructive action.
              </Dialog.Description>
              <Dialog.Close className="min-h-10 cursor-pointer rounded-md bg-primary px-3 text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring">
                Cancel
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <output className="block min-h-6 text-sm text-muted-foreground">Edit actions: {edits}</output>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/icon-tooltip")({
  head: () =>
    showroomHead({
      title: "Icon tooltip",
      description: "Hover and keyboard labels for icon-only actions.",
      path: "/icon-tooltip",
    }),
  component: IconTooltipExample,
});
