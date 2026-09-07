import { Image } from "@/components/forge/ui/image"
import { Breadcrumb, type Crumb } from "@/components/forge/ui/breadcrumb"
import { cn } from "@/lib/forge/utils"

export interface PageHeroProps {
  title: string
  subtitle?: string
  eyebrow?: string
  backgroundImage?: string
  overlayClass?: string
  homeLabel: string
  breadcrumbs: Crumb[]
  className?: string
}

export function PageHero({
  title,
  subtitle,
  eyebrow,
  backgroundImage,
  overlayClass,
  homeLabel,
  breadcrumbs,
  className,
}: PageHeroProps) {
  const hasImage = !!backgroundImage

  return (
    <section className={cn("relative", hasImage ? "text-dark-foreground" : "bg-muted", className)}>
      {hasImage && (
        <>
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            aria-hidden="true"
          />
          <div className={cn("absolute inset-0 bg-black/50", overlayClass)} />
        </>
      )}

      <div className="relative z-10">
        <Breadcrumb
          homeLabel={homeLabel}
          items={breadcrumbs}
          className={hasImage ? "text-dark-foreground/70 [&_a]:text-dark-foreground/70 [&_a:hover]:text-dark-foreground [&_span]:text-dark-foreground" : ""}
        />

        <div className="container-premium pb-16 pt-8 md:pb-20 md:pt-12">
          {eyebrow && (
            <span
              className={cn(
                "mb-3 inline-block font-eyebrow text-sm font-semibold uppercase tracking-[0.18em]",
                hasImage ? "text-dark-foreground/80" : "text-primary",
              )}
            >
              {eyebrow}
            </span>
          )}
          <h1
            className={cn(
              "font-heading text-pretty text-3xl font-bold leading-tight sm:text-4xl md:text-5xl",
              hasImage ? "text-dark-foreground" : "text-foreground",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={cn(
                "mt-4 max-w-2xl text-lg leading-relaxed",
                hasImage ? "text-dark-foreground/80" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
