import { createFileRoute } from "@tanstack/react-router";
import { FileTextIcon, FolderIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { SubpageSidebar, type SidebarNavGroup } from "@/components/subpage-sidebar";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const groups: SidebarNavGroup[] = [
  {
    id: "project",
    items: [
      { id: "overview", label: "Overview", href: "#overview", icon: <LayoutDashboardIcon /> },
      {
        id: "documents",
        label: "Documents",
        href: "#documents",
        icon: <FolderIcon />,
        items: [
          { id: "brief", label: "Design brief", href: "#documents/brief", icon: <FileTextIcon /> },
          {
            id: "guides",
            label: "Guides",
            icon: <FolderIcon />,
            items: [
              { id: "handover", label: "Project handover", href: "#documents/guides/handover" },
            ],
          },
        ],
      },
      { id: "settings", label: "Settings", href: "#settings", icon: <SettingsIcon /> },
    ],
  },
];

const pages: Record<string, { title: string; description: string }> = {
  "#overview": {
    title: "Project overview",
    description:
      "Use the sidebar to browse the sample project. Documents has its own page and expandable subpages.",
  },
  "#documents": {
    title: "Documents",
    description:
      "The design brief and handover guide belong to this project. Expand Documents to open either page.",
  },
  "#documents/brief": {
    title: "Design brief",
    description:
      "Keep the customer's content, routes and permissions in the host application. Reuse the shared navigation for the project's pages.",
  },
  "#documents/guides/handover": {
    title: "Project handover",
    description:
      "Review the project with the customer, verify access, and record the agreed publishing steps.",
  },
  "#settings": {
    title: "Project settings",
    description:
      "This example uses local navigation only. A real application supplies its own settings and permission checks.",
  },
};

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function SubpageSidebarExample() {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.hash || "#overview",
    () => "#overview",
  );
  const page = pages[pathname] ?? pages["#overview"];
  return (
    <ShowroomPreview>
      <ShowroomIntro title="Subpage sidebar">
        Reuse the intranet navigation within a page. Nested links expand beside the content on
        desktop and open in a drawer on mobile.
      </ShowroomIntro>
      <div className="flex min-h-96 min-w-0 flex-col gap-5 md:flex-row">
        <SubpageSidebar groups={groups} pathname={pathname} />
        <section className="min-w-0 flex-1 py-4" aria-labelledby="factory-subpage-title">
          <h2 id="factory-subpage-title" className="text-xl font-semibold">
            {page.title}
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {page.description}
          </p>
        </section>
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/subpage-sidebar")({
  head: ({ match }) =>
    showroomHead({
      title: "Subpage sidebar",
      description: "Nested page navigation with a mobile drawer.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: SubpageSidebarExample,
});
