import { Breadcrumb, type Crumb, type BreadcrumbProps } from "@/components/breadcrumb";
import { Image } from "@/components/image";
import { cn } from "@/components/utils/cn";

export interface PageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backgroundImage?: string;
  overlayClass?: string;
  homeLabel: string;
  homeHref?: string;
  breadcrumbLabel?: string;
  linkComponent?: BreadcrumbProps["linkComponent"];
  breadcrumbs: Crumb[];
  className?: string;
}

export function PageHero({
  title,
  subtitle,
  eyebrow,
  backgroundImage,
  overlayClass,
  homeLabel,
  homeHref,
  breadcrumbLabel,
  linkComponent,
  breadcrumbs,
  className,
}: PageHeroProps) {
  const hasImage = !!backgroundImage;

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
          <div className={cn("absolute inset-0 bg-dark/50", overlayClass)} />
        </>
      )}

      <div className="relative z-10">
        <Breadcrumb
          homeLabel={homeLabel}
          homeHref={homeHref}
          label={breadcrumbLabel}
          linkComponent={linkComponent}
          items={breadcrumbs}
          className={
            hasImage
              ? "text-dark-foreground/70 [&_a]:text-dark-foreground/70 [&_a:hover]:text-dark-foreground [&_span]:text-dark-foreground"
              : ""
          }
        />

        <div className="mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-8 md:pt-12 md:pb-20 lg:px-12">
          {eyebrow && (
            <span
              className={cn(
                "font-eyebrow mb-3 inline-block text-sm font-semibold tracking-[0.18em] uppercase",
                hasImage ? "text-dark-foreground/80" : "text-primary",
              )}
            >
              {eyebrow}
            </span>
          )}
          <h1
            className={cn(
              "font-serif text-3xl leading-tight font-bold text-pretty sm:text-4xl md:text-5xl",
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
  );
}
