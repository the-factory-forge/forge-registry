"use client";

import { useState } from "react";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/accordion";
import { SectionHeading } from "@/components/section-heading";
import { cn } from "@/components/utils/cn";
import { type SectionVariant, sectionVariantClasses } from "@/components/utils/section-variants";

export interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

export interface FaqListProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: FaqItem[];
  allLabel?: string;
  filterLabel?: string;
  emptyMessage?: string;
  variant?: SectionVariant;
  className?: string;
}

export function FaqList({
  eyebrow,
  title,
  subtitle,
  items,
  allLabel = "All",
  filterLabel = "Filter questions",
  emptyMessage = "No questions yet.",
  variant = "default",
  className,
}: FaqListProps) {
  const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean))) as string[];
  const hasCategories = categories.length > 1;
  const [active, setActive] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState("");
  function selectCategory(category: string | null) {
    setActive(category);
    setOpenItem("");
  }

  const colors = sectionVariantClasses[variant];
  const activeCategory = hasCategories && categories.includes(active ?? "") ? active : null;
  const filtered = items
    .map((faq, index) => ({ faq, index }))
    .filter(({ faq }) => !activeCategory || faq.category === activeCategory);

  return (
    <section
      className={cn(
        "py-20 md:py-28 lg:py-36",
        "[contain-intrinsic-size:auto_800px] [content-visibility:auto]",
        colors.section,
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} variant={variant} />

        {hasCategories && (
          <fieldset className="mt-8 flex flex-wrap justify-center gap-2">
            <legend className="sr-only">{filterLabel}</legend>
            <button
              type="button"
              onClick={() => selectCategory(null)}
              aria-pressed={activeCategory === null}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                activeCategory === null
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
                onClick={() => selectCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {cat}
              </button>
            ))}
          </fieldset>
        )}

        <Accordion
          className="mx-auto mt-10 max-w-3xl"
          value={openItem}
          onValueChange={(value) => setOpenItem(typeof value === "string" ? value : "")}
        >
          {filtered.map(({ faq, index }) => (
            <AccordionItem key={index} value={String(index)} className={colors.cardBorder}>
              <AccordionTrigger className={cn("text-base", colors.heading)}>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent keepMounted className={colors.body}>
                <p className="leading-relaxed">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
          {items.length === 0 && (
            <p className={cn("text-center text-sm", colors.body)}>{emptyMessage}</p>
          )}
        </Accordion>
      </div>
    </section>
  );
}
