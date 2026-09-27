"use client";

import { useState } from "react";

import { SectionHeading } from "@/components/section-heading";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import { type SectionVariant, sectionVariantClasses } from "@/components/utils/section-variants";

export interface PricingItem {
  code?: string;
  name: string;
  description?: string;
  duration?: string;
  price: string;
}

export const DEFAULT_PRICING_COLUMNS = {
  code: "Code",
  name: "Service",
  description: "Description",
  duration: "Duration",
  price: "Price",
};

export interface PricingTableProps {
  searchLabel?: string;
  clearSearchLabel?: string;
  emptyMessage?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: PricingItem[];
  insuranceNote?: string;
  cancellationNote?: string;
  columns?: Partial<typeof DEFAULT_PRICING_COLUMNS>;
  variant?: SectionVariant;
  className?: string;
}

export function PricingTable({
  searchLabel = "Search services",
  clearSearchLabel = "Clear search",
  emptyMessage = "No services match your search.",
  eyebrow,
  title,
  subtitle,
  items,
  insuranceNote,
  cancellationNote,
  columns,
  variant = "default",
  className,
}: PricingTableProps) {
  const [search, setSearch] = useState("");
  const filteredItems = items.filter((item) =>
    matchesTableSearch(search, item.code, item.name, item.description, item.duration, item.price),
  );
  const colors = sectionVariantClasses[variant];
  const cols = { ...DEFAULT_PRICING_COLUMNS, ...columns };

  const hasCode = items.some((i) => i.code);
  const hasDuration = items.some((i) => i.duration);
  const hasDescription = items.some((i) => i.description);

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
        <div className="mx-auto mt-6 flex max-w-4xl justify-end">
          <TableSearch
            value={search}
            onValueChange={setSearch}
            label={searchLabel}
            clearLabel={clearSearchLabel}
          />
        </div>
        <div className="mx-auto mt-3 max-w-4xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-secondary">
                {hasCode && (
                  <th className="px-4 py-3 font-semibold text-foreground">{cols.code}</th>
                )}
                <th className="px-4 py-3 font-semibold text-foreground">{cols.name}</th>
                {hasDescription && (
                  <th className="hidden px-4 py-3 font-semibold text-foreground md:table-cell">
                    {cols.description}
                  </th>
                )}
                {hasDuration && (
                  <th className="px-4 py-3 font-semibold text-foreground">{cols.duration}</th>
                )}
                <th className="px-4 py-3 text-right font-semibold text-foreground">{cols.price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => (
                <tr key={item.name} className="transition-colors hover:bg-muted/50">
                  {hasCode && (
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.code}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                  {hasDescription && (
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {item.description}
                    </td>
                  )}
                  {hasDuration && (
                    <td className="px-4 py-3 text-muted-foreground">{item.duration}</td>
                  )}
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {item.price}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + Number(hasCode) + Number(hasDescription) + Number(hasDuration)}
                    className="px-4 py-3 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(insuranceNote || cancellationNote) && (
          <div className="mx-auto mt-6 max-w-4xl space-y-2 text-sm text-muted-foreground">
            {insuranceNote && <p>{insuranceNote}</p>}
            {cancellationNote && <p>{cancellationNote}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
