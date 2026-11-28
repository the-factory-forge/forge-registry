import { createFileRoute } from "@tanstack/react-router";
import { PanelRightIcon } from "lucide-react";
import { useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";
import { cn } from "@/components/utils/cn";
import { viewPreferenceKey } from "@/components/utils/view-preference";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const sections = [
  { title: "Overview", prompt: "What should this project achieve?" },
  { title: "Deliverables", prompt: "What will be ready for review?" },
  { title: "Review notes", prompt: "What needs a decision before handover?" },
  { title: "Handover", prompt: "Who will maintain the finished work?" },
];

const checklistGroups = [
  { id: "factory-review-checklist", title: "Ready for review" },
  { id: "factory-handover-checklist", title: "Ready for handover" },
];

function ContentSidebarLayoutExample() {
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
      {/* The sticky sidebar clears the desktop Details button and its bottom margin. */}
      <div className="@container/sidebar-example flex flex-col [--details-clearance:--spacing(14)] [--details-host-offset:var(--intranet-top-offset,0rem)]">
        <ShowroomIntro title="Content sidebar layout">
          Keep supporting controls beside the page while you work. Close Details to use the full
          width; on narrow screens, the panel sits above the content.
        </ShowroomIntro>
        <ContentSidebarLayout
          className="flex-1 [--intranet-top-offset:calc(var(--details-host-offset)+var(--details-clearance))]"
          defaultOpen
          preferenceKey={viewPreferenceKey("showroom", "content-sidebar-layout", "details")}
          renderHeader={(open, setOpen) => (
            <IconTooltip label="Details" disabled={open}>
              <button
                type="button"
                aria-label="Details"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={cn(
                  "mb-6 inline-flex min-h-10 cursor-pointer items-center self-end rounded-md border border-border px-2.75 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-8 md:px-1.75",
                  "@min-[64rem]/sidebar-example:sticky @min-[64rem]/sidebar-example:top-[calc(var(--details-host-offset)+1rem)] @min-[64rem]/sidebar-example:z-10 @min-[64rem]/sidebar-example:mt-[calc(-1*var(--details-clearance))]",
                  open
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-background text-foreground hover:bg-accent",
                )}
              >
                <PanelRightIcon className="size-4 shrink-0" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid motion-safe:transition-[grid-template-columns] motion-safe:duration-150",
                    open ? "grid-cols-[1fr] ease-out" : "grid-cols-[0fr] ease-in",
                  )}
                >
                  <span className="min-w-0 overflow-hidden whitespace-nowrap">
                    <span className="ps-2">Details</span>
                  </span>
                </span>
              </button>
            </IconTooltip>
          )}
          sidebar={
            <aside
              aria-label="Project details"
              className="space-y-6 rounded-xl border border-border bg-card px-4 pb-4 text-card-foreground @min-[64rem]/content-sidebar:max-h-[calc(100dvh-var(--intranet-top-offset,0rem)-2rem)] @min-[64rem]/content-sidebar:overflow-y-auto"
            >
              <div className="space-y-2 pt-4">
                <h2 className="font-semibold">Project details</h2>
                <p className="text-sm text-muted-foreground">Sample review checklist</p>
              </div>
              <div>
                {checklistGroups.map(({ id, title }) => (
                  <section key={id} aria-labelledby={id}>
                    <h3
                      id={id}
                      className="sticky top-[var(--details-host-offset,0rem)] z-10 bg-card py-2 text-sm font-medium supports-backdrop-filter:bg-card/60 supports-backdrop-filter:backdrop-blur-sm @min-[64rem]/content-sidebar:top-0"
                    >
                      {title}
                    </h3>
                    <div className="space-y-4 py-2">
                      {Array.from({ length: longPanel ? 16 : 4 }, (_, index) => (
                        <label key={index} className="flex min-h-10 items-center gap-3 text-sm">
                          <input type="checkbox" />
                          {sections[index % sections.length].title} ·{" "}
                          {Math.floor(index / sections.length) + 1}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </aside>
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
      </div>
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
