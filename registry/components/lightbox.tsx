"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import { cn } from "@/components/utils/cn";

export interface LightboxCollectionImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
}

export interface LightboxProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  enlargeLabel?: string;
  closeLabel?: string;
  children?: React.ReactNode;
  images?: readonly LightboxCollectionImage[];
  activeImageId?: string;
  onActiveImageChange?: (id: string) => void;
  previousLabel?: string;
  nextLabel?: string;
  imageErrorLabel?: string;
}

export function Lightbox({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  className,
  enlargeLabel = "Click to enlarge",
  closeLabel = "Close",
  children,
  images,
  activeImageId,
  onActiveImageChange,
  previousLabel = "Previous image",
  nextLabel = "Next image",
  imageErrorLabel = "This image could not be loaded.",
}: LightboxProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const [failedSrc, setFailedSrc] = useState<string>();
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const lastWheel = useRef(0);
  const collection = images?.length ? images : [{ id: src, src, alt }];
  const first = collection.find((image) => image.src === src) ?? collection[0];
  const current = collection.find((image) => image.id === (activeImageId ?? selectedId)) ?? first;
  const index = collection.indexOf(current);
  const canBrowse = collection.length > 1;

  function move(delta: number) {
    if (!canBrowse) return;
    const next = collection[(index + delta + collection.length) % collection.length];
    setSelectedId(next.id);
    setFailedSrc(undefined);
    onActiveImageChange?.(next.id);
  }

  const control =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dark-foreground/10 text-dark-foreground hover:bg-dark-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-foreground";
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          setSelectedId(first.id);
          setFailedSrc(undefined);
        }
        gesture.current = null;
      }}
    >
      <Dialog.Trigger
        className={cn(
          "group/lightbox relative block w-full cursor-pointer overflow-hidden border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
          className,
        )}
        aria-label={alt ? `${enlargeLabel} : ${alt}` : enlargeLabel}
      >
        {children ?? (
          <Image
            src={src}
            alt={alt}
            fill={fill}
            width={!fill ? width : undefined}
            height={!fill ? height : undefined}
            sizes={sizes}
            className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover/lightbox:scale-105"
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover/lightbox:bg-foreground/10">
          <span className="rounded-full bg-foreground/50 px-3 py-1.5 text-xs font-medium text-background opacity-0 backdrop-blur-sm transition-opacity group-hover/lightbox:opacity-100">
            {enlargeLabel}
          </span>
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-dark/90 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <Dialog.Popup
            className="w-max max-w-full outline-none"
            onKeyDown={(event) => {
              if (!canBrowse || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1);
            }}
          >
            <Dialog.Title className="sr-only">{current.alt || enlargeLabel}</Dialog.Title>
            <IconTooltip label={closeLabel}>
              <Dialog.Close
                className="fixed top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-dark-foreground/10 text-dark-foreground backdrop-blur-sm transition-colors hover:bg-dark-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed"
                aria-label={closeLabel}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              {canBrowse && (
                <button
                  type="button"
                  className={control}
                  aria-label={previousLabel}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
              )}
              <div
                className="flex min-w-0 touch-pan-y items-center justify-center"
                onPointerDown={(event) => {
                  if (!canBrowse || event.pointerType === "mouse" || !event.isPrimary) return;
                  gesture.current = { x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  gesture.current = null;
                }}
                onPointerUp={(event) => {
                  const start = gesture.current;
                  gesture.current = null;
                  if (!start || !event.isPrimary) return;
                  const dx = event.clientX - start.x;
                  const dy = event.clientY - start.y;
                  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
                }}
                onWheel={(event) => {
                  if (
                    !canBrowse ||
                    Math.abs(event.deltaX) < 35 ||
                    Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.4
                  )
                    return;
                  const now = Date.now();
                  if (now - lastWheel.current < 350) return;
                  lastWheel.current = now;
                  move(event.deltaX > 0 ? 1 : -1);
                }}
              >
                {failedSrc === current.src ? (
                  <p role="status" className="px-4 py-12 text-center text-dark-foreground">
                    {imageErrorLabel}
                  </p>
                ) : (
                  <img
                    key={current.id}
                    src={current.src}
                    alt={current.alt}
                    className="max-h-[85dvh] max-w-full rounded-lg object-contain"
                    draggable={false}
                    onError={() => setFailedSrc(current.src)}
                  />
                )}
              </div>
              {canBrowse && (
                <button
                  type="button"
                  className={control}
                  aria-label={nextLabel}
                  onClick={() => move(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              )}
            </div>
            {(canBrowse || current.caption) && (
              <div className="mt-3 flex justify-center gap-3 text-sm text-dark-foreground">
                {current.caption && (
                  <Dialog.Description className="break-words">{current.caption}</Dialog.Description>
                )}
                {canBrowse && (
                  <output aria-live="polite" className="shrink-0 tabular-nums">
                    {index + 1} / {collection.length}
                  </output>
                )}
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
