import { SectionHeading } from "@/components/forge/ui/section-heading";
import { type SectionVariant, sectionVariantClasses } from "@/lib/forge/section-variants";
import { cn } from "@/lib/forge/utils";

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

interface PricingTableProps {
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
        <div className="mx-auto mt-10 max-w-4xl overflow-x-auto">
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
              {items.map((item) => (
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
