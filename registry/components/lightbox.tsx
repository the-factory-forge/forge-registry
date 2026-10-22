"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import { cn } from "@/components/utils/cn";

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
}: LightboxProps) {
  return (
    <Dialog.Root>
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
            className="object-cover transition-transform duration-500 group-hover/lightbox:scale-105"
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
          <Dialog.Popup className="outline-none">
            <Dialog.Title className="sr-only">{alt || enlargeLabel}</Dialog.Title>
            <IconTooltip label={closeLabel}>
              <Dialog.Close
                className="fixed top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-dark-foreground/10 text-dark-foreground backdrop-blur-sm transition-colors hover:bg-dark-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed"
                aria-label={closeLabel}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
