import type { ReactNode } from "react";

import { CtaLink } from "@/components/forge/ui/cta-button";
import { cn } from "@/lib/forge/utils";

export interface NotFoundCta {
  label: string;
  href: string;
}

export interface NotFoundLogo {
  src: string;
  alt: string;
  href?: string;
}

export interface NotFoundPageProps {
  title?: string;
  description?: string;
  /** Badge pill shown above the error code (e.g. "Erreur 404"). */
  badge?: string;
  /** Brand logo shown at the top, linked to home by default. */
  logo?: NotFoundLogo;
  /** Themed icon in a round pastille (used when the site has no logo). */
  icon?: ReactNode;
  /** Primary CTA (defaults to ctaLabel/ctaHref for backward compatibility). */
  primaryCta?: NotFoundCta;
  /** Secondary CTA rendered as an outline button next to the primary one. */
  secondaryCta?: NotFoundCta;
  /** Foot line below the CTAs (e.g. an emergency line with a phone link). */
  footnote?: ReactNode;
  errorCode?: string;
  ctaClassName?: string;
  className?: string;
}

export function NotFoundPage({
  title = "Page not found",
  description = "The page you are looking for does not exist or has been moved.",
  badge,
  logo,
  icon,
  primaryCta,
  secondaryCta,
  footnote,
  ctaLabel,
  ctaHref,
  errorCode = "404",
  ctaClassName,
  className,
}: NotFoundPageProps & { ctaLabel?: string; ctaHref?: string }) {
  const cta = primaryCta ?? { label: ctaLabel ?? "Back to home", href: ctaHref ?? "/" };

  return (
    <main
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center px-5 py-20 text-center",
        className,
      )}
    >
      {logo && (
        <a
          href={logo.href ?? "/"}
          className="mb-8 inline-block"
          aria-label={logo.alt}
          title={logo.alt}
        >
          <img src={logo.src} alt={logo.alt} className="h-11 w-auto" />
        </a>
      )}
      {icon && (
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      )}
      {badge && (
        <span className="mb-2 inline-block rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground">
          {badge}
        </span>
      )}
      <span className="text-8xl font-bold text-primary/20">{errorCode}</span>
      <h1 className="mt-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <CtaLink href={cta.href} size="lg" className={ctaClassName}>
          {cta.label}
        </CtaLink>
        {secondaryCta && (
          <CtaLink href={secondaryCta.href} size="lg" variant="outline">
            {secondaryCta.label}
          </CtaLink>
        )}
      </div>
      {footnote && <div className="mt-12 border-t border-border pt-8">{footnote}</div>}
    </main>
  );
}
