import { HeroAnimation } from "@/components/forge/ui/animations";
import { CtaExternal, CtaLink } from "@/components/forge/ui/cta-button";
import { Image } from "@/components/forge/ui/image";
import { cn } from "@/lib/forge/utils";

export interface HomeHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; external?: boolean };
  backgroundImage?: string;
  backgroundSrcSet?: string;
  /** Eager + high fetch priority for the background image (default true - full-bleed heroes are usually the LCP). */
  backgroundPriority?: boolean;
  overlayClass?: string;
  className?: string;
}

export function HomeHero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  backgroundImage,
  backgroundSrcSet,
  backgroundPriority = true,
  overlayClass,
  className,
}: HomeHeroProps) {
  return (
    <section className={cn("relative flex min-h-[90vh] items-center", className)}>
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority={backgroundPriority}
          sizes="100vw"
          srcSet={backgroundSrcSet}
          className="object-cover"
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70",
          overlayClass,
        )}
      />

      <div className="relative z-10 container-premium py-32 md:py-40">
        <HeroAnimation>
          <div className="max-w-3xl space-y-6">
            {eyebrow && (
              <span className="font-eyebrow inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-semibold text-primary-foreground backdrop-blur-sm">
                {eyebrow}
              </span>
            )}
            <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight text-pretty text-dark-foreground sm:text-5xl md:text-6xl">
              {title}
            </h1>
            {subtitle && (
              <p className="max-w-2xl text-lg leading-relaxed text-dark-foreground/80 md:text-xl">
                {subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-4 pt-2">
              {primaryCta.external ? (
                <CtaExternal href={primaryCta.href} size="lg">
                  {primaryCta.label}
                </CtaExternal>
              ) : (
                <CtaLink href={primaryCta.href} size="lg">
                  {primaryCta.label}
                </CtaLink>
              )}
              {secondaryCta &&
                (secondaryCta.external ? (
                  <CtaExternal href={secondaryCta.href} variant="onDark" size="lg">
                    {secondaryCta.label}
                  </CtaExternal>
                ) : (
                  <CtaLink href={secondaryCta.href} variant="onDark" size="lg">
                    {secondaryCta.label}
                  </CtaLink>
                ))}
            </div>
          </div>
        </HeroAnimation>
      </div>
    </section>
  );
}
