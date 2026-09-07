import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { ImageWithFallback } from "@/components/forge/ui/image-with-fallback";
import { Link } from "@/components/forge/ui/link";
import { cn } from "@/lib/forge/utils";

export interface ServiceCardProps {
  title: string;
  description: string;
  image: string;
  href: string;
  icon?: LucideIcon;
  iconVariant?: "primary" | "secondary" | "accent";
  imageAlt?: string;
  imageSrcSet?: string;
  readMoreLabel?: string;
  fallbackLabel?: string;
  className?: string;
}

const iconVariantClasses = {
  primary: { badge: "bg-primary", icon: "text-primary-foreground" },
  secondary: { badge: "bg-secondary", icon: "text-secondary-foreground" },
  accent: { badge: "bg-accent", icon: "text-accent-foreground" },
} as const;

export function ServiceCard({
  title,
  description,
  image,
  href,
  icon: Icon,
  iconVariant = "primary",
  imageAlt,
  imageSrcSet,
  readMoreLabel = "Read more",
  fallbackLabel,
  className,
}: ServiceCardProps) {
  const iv = iconVariantClasses[iconVariant];

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-[calc(0.75rem-1px)]">
        <ImageWithFallback
          src={image}
          alt={imageAlt ?? title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          srcSet={imageSrcSet}
          className="transition-transform duration-500 group-hover:scale-105"
          fallbackLabel={fallbackLabel}
        />
      </div>
      {Icon && (
        <div
          className={cn(
            "relative z-10 -mt-5 ml-5 inline-flex rounded-lg p-2.5 shadow-md",
            iv.badge,
          )}
        >
          <Icon className={cn("h-5 w-5", iv.icon)} aria-hidden="true" />
        </div>
      )}
      <div className={cn("px-5 pb-5", Icon ? "pt-3" : "pt-5")}>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors group-hover:gap-2">
          {readMoreLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
