"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { Image } from "@/components/forge/ui/image";
import { cn } from "@/lib/forge/utils";

export interface ImageWithFallbackProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  srcSet?: string;
  quality?: number;
  className?: string;
  fallbackLabel?: string;
}

export function ImageWithFallback({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  sizes,
  srcSet,
  quality,
  className,
  fallbackLabel = "Photo coming soon",
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false);

  if (errored || !src) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          fill ? "absolute inset-0 h-full w-full" : "",
          className,
        )}
        style={fill ? undefined : { width, height }}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-8 w-8 opacity-50" aria-hidden="true" />
        <span className="text-xs font-medium">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      sizes={sizes}
      srcSet={srcSet}
      quality={quality ?? (priority ? 85 : 75)}
      onError={() => setErrored(true)}
      className={cn(fill ? "object-cover" : "", className)}
    />
  );
}
