import { createFileRoute } from "@tanstack/react-router";

import { ImageWithFallback } from "@/components/image-with-fallback";
import { Lightbox } from "@/components/lightbox";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const collection = [
  {
    id: "first",
    src: "/icon.png?view=first",
    alt: "First collection image",
    caption: "First image in the example.",
  },
  {
    id: "second",
    src: "/icon.png?view=second",
    alt: "Second collection image",
    caption: "Second image in the example.",
  },
  { id: "missing", src: "/missing-lightbox-example.png", alt: "Unavailable collection image" },
];

function LightboxExample() {
  return (
    <ShowroomPreview width="narrow">
      <div className="space-y-6">
        <ShowroomIntro title="Lightbox">
          Enlarge an image with the mouse or keyboard. Escape closes the preview and returns focus.
        </ShowroomIntro>
        <Lightbox
          src="/icon.png"
          alt="Forge logo"
          width={320}
          height={320}
          className="flex justify-center rounded-xl border border-border bg-muted p-8"
        />
        <Lightbox
          src={collection[1].src}
          alt={collection[1].alt}
          images={collection}
          width={320}
          height={320}
          className="flex justify-center rounded-xl border border-border bg-muted p-8"
        />
        <ImageWithFallback
          src=""
          alt="Missing photo"
          width={320}
          height={180}
          className="max-w-full rounded-xl"
        />
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/lightbox")({
  head: ({ match }) =>
    showroomHead({
      title: "React lightbox demo",
      description:
        "Accessible image enlargement and a captioned placeholder for unavailable images.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: LightboxExample,
});
