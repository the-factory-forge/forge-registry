"use client";

import { useState, type ComponentType } from "react";

import type { ImageProps } from "@/components/image";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { Lightbox } from "@/components/lightbox";
import { cn } from "@/components/utils/cn";

import { MenuLabelBadge } from "./label-badge";
import { MenuLabelOptions } from "./label-options";
import { getMenuFilterLabels } from "./label-presets";
import { menusLabels, type MenusLabels } from "./labels";
import { menuPriceFormatter } from "./price";
import { MenuSizePrices } from "./size-prices";
import { MenuSpiceBadge } from "./spice-badge";
import type { MenuViewCategory, MenuViewLabel } from "./types";
import { outlineButton } from "./ui";

export interface MenuFilters {
  allergen: string[];
  dietary: string[];
}
export interface ComposedMenuPageProps {
  sections: readonly MenuViewCategory[];
  locale: string;
  currency: string;
  currencyLabel?: string;
  title?: string;
  description?: string;
  filterLabels?: readonly MenuViewLabel[];
  imageUrl?: (itemId: string) => string;
  imageComponent?: ComponentType<ImageProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
  displayMode?: "lines" | "photos";
  filters?: MenuFilters;
  onFiltersChange?: (filters: MenuFilters) => void;
  hideHeading?: boolean;
  sectionHeadingLevel?: 2 | 3 | 4;
}

export function ComposedMenuPage({
  sections,
  locale,
  currency,
  currencyLabel = currency,
  title,
  description,
  filterLabels,
  imageUrl,
  imageComponent: MenuImage,
  labels: overrides,
  className,
  displayMode = "lines",
  filters,
  onFiltersChange,
  hideHeading = false,
  sectionHeadingLevel = 2,
}: ComposedMenuPageProps) {
  const CategoryHeading = `h${sectionHeadingLevel}` as const;
  const DishHeading = `h${sectionHeadingLevel + 1}` as "h3" | "h4" | "h5";
  const labels = { ...menusLabels, ...overrides };
  const [localFilters, setLocalFilters] = useState<MenuFilters>({ allergen: [], dietary: [] });
  const selected = filters ?? localFilters;
  const setFilters = (next: MenuFilters) =>
    onFiltersChange ? onFiltersChange(next) : setLocalFilters(next);
  const withPhotos = displayMode === "photos";
  const options = getMenuFilterLabels(sections, locale, filterLabels);
  const allergen = selected.allergen.filter((id) => options.some((label) => label.id === id));
  const dietary = selected.dietary.filter((id) => options.some((label) => label.id === id));
  const hasFilters = !!(allergen.length || dietary.length);
  const filtered = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.labels.some((label) => label.kind === "allergen" && allergen.includes(label.id)) &&
          dietary.every((id) =>
            item.labels.some((label) => label.kind === "dietary" && label.id === id),
          ),
      ),
    }))
    .filter((section) => section.items.length);
  const count = filtered.reduce((total, section) => total + section.items.length, 0);
  const money = menuPriceFormatter(locale, currency);
  const hasPrices = filtered.some((section) =>
    section.items.some((item) => item.priceMinor !== null || item.sizes?.length),
  );
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-foreground sm:px-6",
        className,
      )}
    >
      {(!hideHeading || hasPrices) && (
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          {!hideHeading && (
            <h1 className="font-serif text-3xl font-semibold">{title ?? labels.menu}</h1>
          )}
          {hasPrices && (
            <p className="ml-auto text-sm text-muted-foreground">
              {labels.price} ({currencyLabel})
            </p>
          )}
        </header>
      )}
      {description && (
        <p className="max-w-prose whitespace-pre-wrap text-muted-foreground">{description}</p>
      )}
      {!!options.length && (
        <div className="space-y-3 border-y border-border py-5">
          {(["allergen", "dietary"] as const).map((kind) => (
            <MenuLabelOptions
              key={kind}
              legend={
                kind === "allergen" ? (labels.excludeAllergens ?? labels.allergens) : labels.dietary
              }
              labels={options.filter((label) => label.kind === kind)}
              value={selected[kind]}
              onChange={(value) => setFilters({ ...selected, [kind]: value })}
            />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <output className="text-sm text-muted-foreground" aria-live="polite">
              {hasFilters && !count ? labels.noFilterMatches : `${labels.matchingItems}: ${count}`}
            </output>
            <button
              className={outlineButton}
              disabled={!hasFilters}
              onClick={() => setFilters({ allergen: [], dietary: [] })}
            >
              {labels.clearFilters}
            </button>
          </div>
        </div>
      )}
      {sections.length === 0 && <p className="text-muted-foreground">{labels.emptyMenu}</p>}
      {filtered.map((section) => (
        <section key={section.id} aria-label={section.name} className="space-y-4">
          <CategoryHeading className="font-serif text-2xl font-semibold">
            {section.name}
          </CategoryHeading>
          {section.description && (
            <p className="max-w-prose whitespace-pre-wrap text-muted-foreground">
              {section.description}
            </p>
          )}
          <div>
            {section.items.map((item) => {
              const photoUrl = item.imageEntryId ? imageUrl?.(item.id) : undefined;
              const photoNode =
                MenuImage && photoUrl ? (
                  <MenuImage
                    src={photoUrl ?? ""}
                    alt={item.name}
                    className="h-20 w-full rounded-lg object-cover"
                  />
                ) : (
                  <ImageWithFallback
                    key={item.imageEntryId ?? "empty"}
                    src={photoUrl ?? ""}
                    alt={item.name}
                    fallbackLabel={labels.noPhoto}
                    className="h-20 w-full rounded-lg object-cover [&_figcaption]:px-1 [&_figcaption]:text-center [&_figcaption]:leading-tight"
                  />
                );
              return (
                <article
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-border py-4 sm:gap-x-6",
                    withPhotos &&
                      "min-h-32 grid-cols-[minmax(0,1fr)_4rem_auto] sm:grid-cols-[minmax(0,1fr)_7.5rem_auto]",
                  )}
                >
                  <div className="min-w-0 space-y-2">
                    <DishHeading className="font-medium wrap-anywhere">{item.name}</DishHeading>
                    {item.description && (
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {!!(item.labels.length || item.spiceLevel) && (
                      <div className="flex flex-wrap gap-1.5">
                        <MenuSpiceBadge level={item.spiceLevel ?? 0} labels={labels} />
                        {item.labels.map((label) => (
                          <MenuLabelBadge key={label.id} label={label} />
                        ))}
                      </div>
                    )}
                  </div>
                  {withPhotos &&
                    (photoUrl ? (
                      <Lightbox src={photoUrl} alt={item.name} className="h-20 w-full rounded-lg">
                        {photoNode}
                      </Lightbox>
                    ) : (
                      photoNode
                    ))}
                  <div className="min-w-12 space-y-2 text-right text-sm tabular-nums sm:min-w-24">
                    {item.sizes?.length ? (
                      <MenuSizePrices
                        sizes={item.sizes}
                        format={money}
                        className="max-w-24 sm:max-w-40"
                      />
                    ) : (
                      item.priceMinor !== null && <span>{money(item.priceMinor)}</span>
                    )}
                    {item.soldOut && (
                      <p className="text-xs text-status-pending-foreground">{labels.soldOut}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
