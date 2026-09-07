// Framework-agnostic Image shim.
// Each site provides the implementation for its framework:
//   - Next.js  : re-export of `next/image`
//   - TanStack : plain <img> (or the site's image component)
// The registry imports this shim and never imports a framework image component.
//
// Next-specific props (fill, priority, sizes, quality) are translated to
// plain <img> equivalents so components keep working everywhere.

import { cn } from "@/lib/forge/utils"

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  width?: number
  height?: number
  unoptimized?: boolean
  /** Fill the parent (absolute inset-0) — next/image compatible. */
  fill?: boolean
  /** Load eagerly with high fetch priority — next/image compatible. */
  priority?: boolean
  sizes?: string
  quality?: number
}

/**
 * Plain <img> based Image. Sites that need an image optimizer replace
 * this file with a framework component — the props above keep the
 * component contract stable.
 */
export function Image({
  src,
  alt,
  width,
  height,
  unoptimized,
  fill,
  priority,
  sizes,
  quality,
  loading,
  className,
  ...props
}: ImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- framework-agnostic shim
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      loading={loading ?? (priority ? "eager" : "lazy")}
      fetchPriority={priority ? "high" : undefined}
      data-quality={quality}
      data-unoptimized={unoptimized || undefined}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
      {...props}
    />
  )
}
