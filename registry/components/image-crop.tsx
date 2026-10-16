"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/components/utils/cn";
import {
  exportImageCrop,
  imageCropRect,
  validImageCropSize,
  type ImageCropSize,
} from "@/components/utils/crop-image";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";

export type { ImageCropSize } from "@/components/utils/crop-image";

const defaultLabels = {
  title: "Crop image",
  description: "Drag the image or use the sliders to frame it. Confirm to create a WebP image.",
  preview: "Crop preview",
  zoom: "Zoom",
  horizontal: "Horizontal position",
  vertical: "Vertical position",
  cancel: "Cancel",
  confirm: "Use image",
  loading: "Loading image…",
  pending: "Preparing image…",
  invalid: "Choose a JPEG, PNG or WebP image within the upload size limit.",
  dimensions: "The requested image dimensions are invalid or too large.",
  decodeError: "This image could not be opened or is too large. Choose another image.",
  saveError: "The image could not be prepared or uploaded. Try again, or choose another image.",
};
export type ImageCropLabels = typeof defaultLabels;

export interface ImageCropDialogProps extends ImageCropSize {
  file: File | null;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
  labels?: Partial<ImageCropLabels>;
  maxFileBytes?: number;
  className?: string;
}

const buttonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8";

export function ImageCropDialog(props: ImageCropDialogProps) {
  return props.file ? <CropSession {...props} file={props.file} /> : null;
}

function CropSession({
  file,
  width,
  height,
  onConfirm,
  onCancel,
  labels: overrides,
  maxFileBytes = 10 * 1024 * 1024,
  className,
}: ImageCropDialogProps & { file: File }) {
  const labels = { ...defaultLabels, ...overrides };
  const id = `factory-image-crop-${useId()}`;
  const canvas = useRef<HTMLCanvasElement>(null);
  const lock = useRef(false);
  const drag = useRef<{ x: number; y: number; horizontal: number; vertical: number } | null>(null);
  const [loaded, setLoaded] = useState<{ file: File; image: HTMLImageElement } | null>(null);
  const [position, setPosition] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const prepared = useRef<{
    source: File;
    width: number;
    height: number;
    position: typeof position;
    file: File;
  } | null>(null);
  const [error, setError] = useState<keyof ImageCropLabels | null>(null);
  const [pending, setPending] = useState(false);
  const ready = loaded?.file === file && validImageCropSize({ width, height });

  useEffect(() => {
    let canceled = false;
    let url: string | undefined;
    const image = new Image();
    void Promise.resolve()
      .then(() => {
        if (canceled) return;
        setLoaded(null);
        setError(null);
        setPosition({ zoom: 1, x: 0.5, y: 0.5 });
        if (!validImageCropSize({ width, height })) {
          setError("dimensions");
          return;
        }
        if (
          !file.size ||
          !Number.isFinite(maxFileBytes) ||
          maxFileBytes <= 0 ||
          file.size > maxFileBytes ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ) {
          setError("invalid");
          return;
        }
        image.onload = () => {
          if (canceled) return;
          if (
            !image.naturalWidth ||
            !image.naturalHeight ||
            image.naturalWidth * image.naturalHeight > 40_000_000
          ) {
            setError("decodeError");
            return;
          }
          setLoaded({ file, image });
        };
        image.onerror = () => {
          if (!canceled) setError("decodeError");
        };
        url = URL.createObjectURL(file);
        image.src = url;
      })
      .catch(() => {
        if (!canceled) setError("decodeError");
      });
    return () => {
      canceled = true;
      image.onload = null;
      image.onerror = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, width, height, maxFileBytes]);

  useEffect(() => {
    if (!ready || !loaded || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    const crop = imageCropRect(
      { width: loaded.image.naturalWidth, height: loaded.image.naturalHeight },
      { width, height },
      position.zoom,
      position.x,
      position.y,
    );
    context.clearRect(0, 0, canvas.current.width, canvas.current.height);
    context.drawImage(
      loaded.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.current.width,
      canvas.current.height,
    );
  }, [loaded, ready, width, height, position]);

  async function confirm() {
    if (!ready || !loaded || lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      // Reuse the same File on retry so host upload idempotency keys stay stable.
      const cached = prepared.current;
      const result =
        cached?.source === file &&
        cached.width === width &&
        cached.height === height &&
        cached.position === position
          ? cached.file
          : await exportImageCrop(
              loaded.image,
              file,
              { width, height },
              position.zoom,
              position.x,
              position.y,
            );
      prepared.current = { source: file, width, height, position, file: result };
      if (result.size > maxFileBytes) throw new Error("Image exceeds upload limit");
      await onConfirm(result);
    } catch {
      setError("saveError");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onCancel();
      }}
    >
      <Dialog.Portal>
        {/* Notifications from a previous upload must not cover the active crop editor. */}
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-foreground/30" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-70 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-card p-5 text-card-foreground shadow-xl sm:p-6",
            className,
          )}
          onKeyDown={submitDialogOnShortcut}
        >
          <Dialog.Title className="text-lg font-semibold">{labels.title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {labels.description}
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void confirm();
            }}
            className="mt-5 space-y-4"
          >
            <div className="flex h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-72">
              <canvas
                ref={canvas}
                width={
                  validImageCropSize({ width, height })
                    ? Math.max(1, Math.round(560 * Math.min(1, width / height)))
                    : 560
                }
                height={
                  validImageCropSize({ width, height })
                    ? Math.max(1, Math.round(560 * Math.min(1, height / width)))
                    : 315
                }
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Canvas is the interactive crop preview, not a static image.
                role="img"
                aria-label={labels.preview}
                className={cn(
                  "max-h-full max-w-full touch-none object-contain",
                  ready ? "cursor-move" : "invisible",
                  pending && "cursor-not-allowed",
                )}
                onPointerDown={(event) => {
                  if (!ready || pending) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    x: event.clientX,
                    y: event.clientY,
                    horizontal: position.x,
                    vertical: position.y,
                  };
                }}
                onPointerMove={(event) => {
                  if (!drag.current || !loaded || pending) return;
                  const crop = imageCropRect(
                    { width: loaded.image.naturalWidth, height: loaded.image.naturalHeight },
                    { width, height },
                    position.zoom,
                  );
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const travelX = loaded.image.naturalWidth - crop.width;
                  const travelY = loaded.image.naturalHeight - crop.height;
                  setPosition({
                    ...position,
                    x:
                      travelX > 0
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              drag.current.horizontal -
                                ((event.clientX - drag.current.x) * crop.width) /
                                  bounds.width /
                                  travelX,
                            ),
                          )
                        : 0.5,
                    y:
                      travelY > 0
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              drag.current.vertical -
                                ((event.clientY - drag.current.y) * crop.height) /
                                  bounds.height /
                                  travelY,
                            ),
                          )
                        : 0.5,
                  });
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {width} × {height} · WebP
            </p>
            <fieldset disabled={!ready || pending} className="space-y-3">
              {(
                [
                  ["zoom", labels.zoom, 1, 3],
                  ["x", labels.horizontal, 0, 1],
                  ["y", labels.vertical, 0, 1],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key} className="space-y-1">
                  <label htmlFor={`${id}-${key}`} className="block text-sm font-medium">
                    {label}
                  </label>
                  <input
                    id={`${id}-${key}`}
                    type="range"
                    min={min}
                    max={max}
                    step={0.01}
                    value={position[key]}
                    onChange={(event) =>
                      setPosition({ ...position, [key]: Number(event.target.value) })
                    }
                    className="block min-h-6 w-full cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              ))}
            </fieldset>
            <div className="min-h-16 text-sm">
              {error ? (
                <p role="alert" className="text-destructive">
                  {labels[error]}
                </p>
              ) : (
                <output className="text-muted-foreground">
                  {pending ? labels.pending : !ready ? labels.loading : ""}
                </output>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close
                type="button"
                disabled={pending}
                className={cn(
                  buttonClass,
                  "border border-border hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {labels.cancel}
              </Dialog.Close>
              <button
                type="submit"
                disabled={!ready || pending}
                className={cn(
                  buttonClass,
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {labels.confirm}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
