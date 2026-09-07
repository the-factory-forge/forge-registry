import type { LucideIcon } from "lucide-react";

import { ServiceCard } from "@/components/forge/sections/service-card";
import { SectionHeading } from "@/components/forge/ui/section-heading";
import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

export interface ServiceItem {
  title: string;
  description: string;
  image: string;
  href: string;
  icon?: LucideIcon;
}

export interface ServicesGridProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  services: ServiceItem[];
  readMoreLabel?: string;
  fallbackLabel?: string;
  variant?: SectionVariant;
  className?: string;
}

export function ServicesGrid({
  eyebrow,
  title,
  subtitle,
  services,
  readMoreLabel,
  fallbackLabel,
  variant = "default",
  className,
}: ServicesGridProps) {
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
        {title && (
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} variant={variant} />
        )}
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const iconVariants = ["primary", "secondary", "accent"] as const;
            return (
              <ServiceCard
                key={service.href}
                title={service.title}
                description={service.description}
                image={service.image}
                href={service.href}
                icon={service.icon}
                iconVariant={iconVariants[i % iconVariants.length]}
                readMoreLabel={readMoreLabel}
                fallbackLabel={fallbackLabel}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
