import { CtaLink, CtaExternal } from "@/components/forge/ui/cta-button";
import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

export interface CtaBandProps {
  title: string;
  description?: string;
  cta: { label: string; href: string; external?: boolean };
  variant?: SectionVariant;
  className?: string;
}

export function CtaBand({ title, description, cta, variant = "primary", className }: CtaBandProps) {
  const colors = sectionVariantClasses[variant];
  const isDark = variant === "primary" || variant === "secondary";
  const ctaVariant = isDark ? "onDark" : "primary";

  return (
    <section
      className={cn(
        "section-padding",
        "[contain-intrinsic-size:auto_800px] [content-visibility:auto]",
        colors.section,
        className,
      )}
    >
      <div className="container-premium text-center">
        <h2
          className={cn(
            "font-heading text-2xl font-bold text-pretty sm:text-3xl md:text-4xl",
            colors.heading,
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn("mx-auto mt-4 max-w-2xl text-lg leading-relaxed", colors.body)}>
            {description}
          </p>
        )}
        <div className="mt-8">
          {cta.external ? (
            <CtaExternal href={cta.href} variant={ctaVariant} size="lg">
              {cta.label}
            </CtaExternal>
          ) : (
            <CtaLink href={cta.href} variant={ctaVariant} size="lg">
              {cta.label}
            </CtaLink>
          )}
        </div>
      </div>
    </section>
  );
}
