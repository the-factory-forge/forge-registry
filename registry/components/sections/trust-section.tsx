import type { LucideIcon } from "lucide-react";

import { Reveal } from "@/components/forge/ui/reveal";
import { SectionHeading } from "@/components/forge/ui/section-heading";
import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

export interface TrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface TrustSectionProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: TrustItem[];
  variant?: SectionVariant;
  className?: string;
}

export function TrustSection({
  eyebrow,
  title,
  subtitle,
  items,
  variant = "muted",
  className,
}: TrustSectionProps) {
  const colors = sectionVariantClasses[variant];

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
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isDark = variant === "primary" || variant === "secondary";
            const isAlt = i % 2 === 1;
            const badgeBg = isAlt
              ? isDark
                ? "bg-primary-foreground/15"
                : "bg-secondary/15"
              : colors.iconBadge;
            const badgeIcon = isAlt
              ? isDark
                ? "text-primary-foreground/80"
                : "text-secondary"
              : colors.iconColor;
            return (
              <Reveal key={item.title} delay={i * 0.1}>
                <div
                  className={cn(
                    "rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md",
                    colors.card,
                    colors.cardBorder,
                  )}
                >
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
                      badgeBg,
                    )}
                  >
                    <Icon className={cn("h-6 w-6", badgeIcon)} aria-hidden="true" />
                  </div>
                  <h3 className={cn("mb-2 text-lg font-semibold", colors.heading)}>{item.title}</h3>
                  <p className={cn("text-sm leading-relaxed", colors.body)}>{item.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
