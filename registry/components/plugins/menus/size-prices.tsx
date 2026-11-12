import { cn } from "@/components/utils/cn";

import type { MenuViewItem } from "./types";

export function MenuSizePrices({
  sizes,
  format,
  className,
  paper,
}: {
  sizes: NonNullable<MenuViewItem["sizes"]>;
  format: (price: number) => string;
  className?: string;
  paper?: boolean;
}) {
  return (
    <dl className={cn("space-y-1 text-right tabular-nums", className)}>
      {sizes.map((size) => (
        <div
          key={size.id}
          className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-x-2"
        >
          <dt className="wrap-anywhere whitespace-normal text-muted-foreground">{size.name}</dt>
          <dd data-menu-print-price={paper || undefined} className="whitespace-nowrap">
            {format(size.priceMinor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
