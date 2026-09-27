import type { ComponentType } from "react";

import { Image, type ImageProps } from "@/components/image";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import type { MenuViewCategory } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export interface MenuPageProps {
  sections: readonly MenuViewCategory[];
  locale: string;
  currency: string;
  imageUrl?: (itemId: string) => string;
  imageComponent?: ComponentType<ImageProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuPage({
  sections,
  locale,
  currency,
  imageUrl,
  imageComponent: MenuImage = Image,
  labels: overrides,
  className,
}: MenuPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const divisor = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl space-y-10 px-4 py-10 text-foreground sm:px-6",
        className,
      )}
    >
      <header>
        <h1 className="font-serif text-4xl font-semibold">{labels.menu}</h1>
      </header>
      {sections.length === 0 ? <p className="text-muted-foreground">{labels.emptyMenu}</p> : null}
      {sections.map((section) => (
        <section key={section.id} className="space-y-5" aria-label={section.name}>
          <h2 className="border-b border-border pb-3 font-serif text-2xl font-semibold">
            {section.name}
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {section.items.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
              >
                {item.imageEntryId && imageUrl ? (
                  <MenuImage
                    src={imageUrl(item.id)}
                    alt={item.name}
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 text-lg font-semibold wrap-anywhere">
                      {item.name}
                    </h3>
                    <div className="ml-auto flex max-w-full flex-col items-end gap-2">
                      {item.soldOut ? (
                        <span className="rounded-full bg-status-pending px-2.5 py-1 text-xs font-medium text-status-pending-foreground">
                          {labels.soldOut}
                        </span>
                      ) : null}
                      <span className="font-semibold">
                        {formatter.format(item.priceMinor / divisor)}
                      </span>
                    </div>
                  </div>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                  {(["allergen", "dietary"] as const).map((kind) => {
                    const tags = item.labels.filter((label) => label.kind === kind);
                    return tags.length ? (
                      <p key={kind} className="text-xs text-muted-foreground">
                        <span className="font-medium">
                          {kind === "allergen" ? labels.allergens : labels.dietary}:
                        </span>{" "}
                        {tags.map((tag) => tag.name).join(", ")}
                      </p>
                    ) : null;
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
