import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Image } from "@/components/image";
import { ImageCropDialog } from "@/components/image-crop";
import { showroomHead } from "@/showroom/seo";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

function ImageCropExample() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
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
      notice="This example prepares a 1200 × 675 WebP locally. No file is sent to a server."
    >
      <div className="space-y-6">
        <ShowroomIntro title="Image crop">
          Choose a JPEG, PNG or WebP, adjust the crop, and confirm. Cancel keeps the previous image.
        </ShowroomIntro>
        <label className="block space-y-2 text-sm font-medium">
          Image to crop
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full cursor-pointer rounded-md text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
        <div className="space-y-3">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {result ? (
              <Image
                src={result.url}
                alt="Confirmed crop"
                width={1200}
                height={675}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Your confirmed image appears here.</p>
            )}
          </div>
          <output className="block min-h-6 text-sm text-muted-foreground">
            {result
              ? `${result.file.name} · ${result.file.type} · ${result.file.size.toLocaleString()} bytes`
              : "No image selected."}
          </output>
        </div>
        <ImageCropDialog
          file={file}
          width={1200}
          height={675}
          onCancel={() => setFile(null)}
          onConfirm={(cropped) => {
            if (fail) throw new Error("Simulated upload failure");
            setResult({ file: cropped, url: URL.createObjectURL(cropped) });
            setFile(null);
          }}
        />
      </div>
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/image-crop")({
  head: ({ match }) =>
    showroomHead({
      title: "React image crop demo",
      description:
        "Crop images to host-supplied dimensions and prepare WebP uploads with accessible controls.",
      path: match.pathname,
      noIndex: match.status !== "success",
    }),
  component: ImageCropExample,
});
