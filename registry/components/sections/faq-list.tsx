"use client"

import { useState } from "react"
import { SectionHeading } from "@/components/forge/ui/section-heading"
import {
  type SectionVariant,
  sectionVariantClasses,
} from "@/lib/forge/section-variants"
import { cn } from "@/lib/forge/utils"

export interface FaqItem {
  question: string
  answer: string
  category?: string
}

export interface FaqListProps {
  eyebrow?: string
  title: string
  subtitle?: string
  items: FaqItem[]
  allLabel?: string
  variant?: SectionVariant
  className?: string
}

export function FaqList({
  eyebrow,
  title,
  subtitle,
  items,
  allLabel = "All",
  variant = "default",
  className,
}: FaqListProps) {
  const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean))) as string[]
  const hasCategories = categories.length > 1
  const [active, setActive] = useState<string | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const colors = sectionVariantClasses[variant]
  const filtered = active ? items.filter((f) => f.category === active) : items

  return (
    <section className={cn("section-padding", "[content-visibility:auto] [contain-intrinsic-size:auto_800px]", colors.section, className)}>
      <div className="container-premium">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} variant={variant} />

        {hasCategories && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActive(null)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {allLabel}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto mt-10 max-w-3xl divide-y divide-border">
          {filtered.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div key={faq.question} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-foreground">{faq.question}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xl transition-transform",
                      isOpen ? "text-secondary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
