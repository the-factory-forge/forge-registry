import { SectionHeading } from "@/components/forge/ui/section-heading"
import { Reveal } from "@/components/forge/ui/reveal"
import {
  type SectionVariant,
  sectionVariantClasses,
} from "@/lib/forge/section-variants"
import { cn } from "@/lib/forge/utils"

export interface Step {
  title: string
  description: string
}

export interface MethodStepsProps {
  eyebrow?: string
  title: string
  subtitle?: string
  steps: Step[]
  variant?: SectionVariant
  className?: string
}

export function MethodSteps({
  eyebrow,
  title,
  subtitle,
  steps,
  variant = "muted",
  className,
}: MethodStepsProps) {
  const colors = sectionVariantClasses[variant]

  return (
    <section className={cn("section-padding", "[content-visibility:auto] [contain-intrinsic-size:auto_800px]", colors.section, className)}>
      <div className="container-premium">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} variant={variant} />
        <div className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute top-10 left-[10%] right-[10%] hidden h-0.5 bg-border lg:block" aria-hidden="true" />

          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.15}>
              <div className="relative text-center">
                <div className={cn(
                  "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold shadow-md",
                    variant === "primary" || variant === "secondary"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                    : i % 2 === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                )}>
                  {i + 1}
                </div>
                <h3 className={cn("mb-2 text-lg font-semibold", colors.heading)}>{step.title}</h3>
                <p className={cn("text-sm leading-relaxed", colors.body)}>
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
