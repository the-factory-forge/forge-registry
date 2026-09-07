import { Quote } from "lucide-react";

import { Reveal } from "@/components/forge/ui/reveal";
import { SectionHeading } from "@/components/forge/ui/section-heading";
import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

export interface Testimonial {
  quote: string;
  name: string;
  role?: string;
  company?: string;
}

export interface TestimonialsProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: Testimonial[];
  variant?: SectionVariant;
  className?: string;
}

export function Testimonials({
  eyebrow,
  title,
  subtitle,
  items,
  variant = "default",
  className,
}: TestimonialsProps) {
  const colors = sectionVariantClasses[variant];
  const isDark = variant === "primary" || variant === "secondary";

  return (
    <section
      className={cn(
        "section-padding",
        "[contain-intrinsic-size:auto_800px] [content-visibility:auto]",
        colors.section,
        className,
      )}
    >
      <div className="container-premium">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} variant={variant} />
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <figure
                className={cn(
                  "flex h-full flex-col rounded-xl border p-6 shadow-sm",
                  colors.card,
                  colors.cardBorder,
                )}
              >
                <Quote
                  className={cn(
                    "mb-4 h-8 w-8 opacity-20",
                    isDark ? "text-primary-foreground" : "text-secondary",
                  )}
                  aria-hidden="true"
                />
                <blockquote className={cn("flex-1 text-sm leading-relaxed", colors.heading)}>
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className={cn("mt-6 border-t pt-4", colors.cardBorder)}>
                  <p className={cn("font-semibold", colors.heading)}>{t.name}</p>
                  {(t.role || t.company) && (
                    <p className={cn("text-sm", colors.body)}>
                      {[t.role, t.company].filter(Boolean).join(" — ")}
                    </p>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
