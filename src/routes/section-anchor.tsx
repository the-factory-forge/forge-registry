import { createFileRoute } from "@tanstack/react-router";

import { SectionAnchor } from "@/components/section-anchor";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function SectionAnchorExample() {
  return (
    <ShowroomPreview>
      <ShowroomIntro title="Section links">
        Click a section title, then reload or share the URL to return to that section.
      </ShowroomIntro>
      <div className="space-y-8">
        {["Overview", "Personal information", "Preferences"].map((title) => (
          <section key={title} className="min-h-[60vh] border-b border-border py-8">
            <h2 className="text-lg font-semibold">
              <SectionAnchor id={`factory-${title.toLowerCase().replaceAll(" ", "-")}`}>
                {title}
              </SectionAnchor>
            </h2>
          </section>
        ))}
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/section-anchor")({ component: SectionAnchorExample });
