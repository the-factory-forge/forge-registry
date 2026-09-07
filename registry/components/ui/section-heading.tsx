import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  as?: "h1" | "h2" | "h3";
  variant?: SectionVariant;
  /** @deprecated Use variant="primary" instead */
  inverted?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  as: Tag = "h2",
  variant: variantProp,
  inverted = false,
  className,
}: SectionHeadingProps) {
  const variant = variantProp ?? (inverted ? "primary" : "default");
  const colors = sectionVariantClasses[variant];
  const isDark = variant === "primary" || variant === "secondary";

  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow ? (
        <>
          <span
            className={cn(
              "font-eyebrow mb-3 inline-block text-sm font-semibold tracking-[0.18em] uppercase",
              colors.eyebrow,
            )}
          >
            {eyebrow}
          </span>
          <span
            className={cn(
              "mb-4 block h-0.5 w-10 rounded-full",
              isDark ? "bg-primary-foreground/40" : "bg-secondary",
              align === "center" ? "mx-auto" : "",
            )}
          />
        </>
      ) : null}
      <Tag
        className={cn(
          "font-heading text-3xl leading-tight font-bold tracking-tight text-pretty sm:text-4xl",
          colors.heading,
        )}
      >
        {title}
      </Tag>
      {subtitle ? (
        <p className={cn("mt-4 text-lg leading-relaxed text-pretty", colors.body)}>{subtitle}</p>
      ) : null}
    </div>
  );
}
