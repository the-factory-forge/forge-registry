import { createFileRoute } from "@tanstack/react-router";
import { PanelRightIcon } from "lucide-react";
import { useState } from "react";

import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";
import { cn } from "@/components/utils/cn";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const sections = [
  { title: "Overview", prompt: "What should this project achieve?" },
  { title: "Deliverables", prompt: "What will be ready for review?" },
  { title: "Review notes", prompt: "What needs a decision before handover?" },
  { title: "Handover", prompt: "Who will maintain the finished work?" },
];

function ContentSidebarLayoutExample() {
  const [open, setOpen] = useState(true);
  const [longPanel, setLongPanel] = useState(false);
  return (
    <ShowroomPreview
      controls={
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={longPanel}
            onChange={(event) => setLongPanel(event.target.checked)}
          />
          Long panel
        </label>
      }
    >
      <ShowroomIntro title="Content sidebar layout">
        Keep supporting controls beside the page while you work. Close Details to use the full
        width; on narrow screens, the panel sits above the content.
      </ShowroomIntro>
      <ContentSidebarLayout
        className="flex-1"
        toolbar={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-8",
                open
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background text-foreground hover:bg-accent",
              )}
            >
              <PanelRightIcon className="size-4 shrink-0" aria-hidden="true" />
              Details
            </button>
          </div>
        }
        sidebar={
          open && (
            <aside
              aria-label="Project details"
              className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <div className="space-y-2">
                <h2 className="font-semibold">Project details</h2>
                <p className="text-sm text-muted-foreground">Sample review checklist</p>
              </div>
              <fieldset className="space-y-4">
                <legend className="mb-4 text-sm font-medium">Ready for review</legend>
                {Array.from({ length: longPanel ? 24 : 4 }, (_, index) => (
                  <label key={index} className="flex min-h-10 items-center gap-3 text-sm">
                    <input type="checkbox" />
                    {sections[index % sections.length].title} ·{" "}
                    {Math.floor(index / sections.length) + 1}
                  </label>
                ))}
              </fieldset>
            </aside>
          )
        }
      >
        <section aria-label="Project brief" className="space-y-6">
          {sections.map(({ title, prompt }) => (
            <label
              key={title}
              className="block space-y-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
            >
              <span className="block text-lg font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">{prompt}</span>
              <textarea
                aria-label={title}
                rows={8}
                className="block w-full rounded-lg border border-input bg-background p-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring md:text-sm"
              />
            </label>
          ))}
        </section>
      </ContentSidebarLayout>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/content-sidebar-layout")({
  head: ({ match }) =>
    showroomHead({
      title: "Content sidebar layout",
      description: "Content beside a sticky supporting panel with persistent controls.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: ContentSidebarLayoutExample,
});
