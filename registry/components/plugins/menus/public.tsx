"use client";

import { LeafIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";

import { Image, type ImageProps } from "@/components/image";
import { Link } from "@/components/link";
import { MenuLabelBadge, menuLabelColorClasses } from "@/components/plugins/menus/label-badge";
import { getMenuFilterLabels } from "@/components/plugins/menus/label-presets";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import { MenuSpiceBadge } from "@/components/plugins/menus/spice-badge";
import type { MenuViewCategory, MenuViewLabel } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export interface MenuPageProps {
  sections: readonly MenuViewCategory[];
  locale: string;
  currency: string;
  filterLabels?: readonly MenuViewLabel[];
  imageUrl?: (itemId: string) => string;
  imageComponent?: ComponentType<ImageProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuPage({
  sections,
  locale,
  currency,
  filterLabels,
  imageUrl,
  imageComponent: MenuImage = Image,
  labels: overrides,
  className,
}: MenuPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const id = `factory-menu-filters-${useId()}`;
  const navigationRef = useRef<HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>();
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{ allergen: string[]; dietary: string[] }>({
    allergen: [],
    dietary: [],
  });
  const options = sections.length ? getMenuFilterLabels(sections, locale, filterLabels) : [];
  const allergens = selected.allergen.filter((id) => options.some((label) => label.id === id));
  const dietary = selected.dietary.filter((id) => options.some((label) => label.id === id));
  const hasFilters = allergens.length > 0 || dietary.length > 0;
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.labels.some((label) => label.kind === "allergen" && allergens.includes(label.id)) &&
          dietary.every((id) =>
            item.labels.some((label) => label.kind === "dietary" && label.id === id),
          ),
      ),
    }))
    .filter((section) => section.items.length > 0);
  const count = filteredSections.reduce((total, section) => total + section.items.length, 0);
  const categoryIds = filteredSections.map((section) => section.id).join(",");
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const links = [...navigation.querySelectorAll<HTMLAnchorElement>("a")];
    const categories = links.flatMap((link) => {
      const section = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      return section ? [{ link, section }] : [];
    });
    let frame = 0;
    let currentSection: string | undefined;
    const update = () => {
      const threshold = navigation.getBoundingClientRect().bottom + 16;
      const current =
        categories.findLast(({ section }) => section.getBoundingClientRect().top <= threshold) ??
        categories[0];
      if (!current) return;
      const atBottom =
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const { link, section } = atBottom ? categories[categories.length - 1] : current;
      if (section.id === currentSection) return;
      currentSection = section.id;
      setActiveCategory(section.id);
      if (
        link.offsetLeft < navigation.scrollLeft ||
        link.offsetLeft + link.offsetWidth > navigation.scrollLeft + navigation.clientWidth
      ) {
        navigation.scrollTo({
          left: link.offsetLeft - (navigation.clientWidth - link.offsetWidth) / 2,
        });
      }
    };
    const schedule = (event: Event) => {
      if (event.target === navigation) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [categoryIds]);
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
      {filteredSections.length ? (
        <nav
          ref={navigationRef}
          aria-label={labels.categories}
          className="sticky top-[var(--menu-top-offset,0px)] z-10 flex gap-2 overflow-x-auto border-b border-border bg-background py-2 print:hidden"
        >
          {filteredSections.map((section, index) => {
            const sectionId = `${id}-category-${section.id}`;
            const active = activeCategory ? activeCategory === sectionId : index === 0;
            return (
              <Link
                key={section.id}
                href={`#${sectionId}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {section.name}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {options.length ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-card-foreground">
          <div className="grid gap-5 sm:grid-cols-2">
            {(["allergen", "dietary"] as const).map((kind) => {
              const tags = options.filter((label) => label.kind === kind);
              const Icon = kind === "allergen" ? TriangleAlertIcon : LeafIcon;
              return tags.length ? (
                <fieldset
                  key={kind}
                  className="min-w-0 space-y-3"
                  aria-describedby={`${id}-${kind}`}
                >
                  <legend className="flex items-center gap-2 font-semibold">
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {kind === "allergen" ? labels.excludeAllergens : labels.dietary}
                  </legend>
                  <p id={`${id}-${kind}`} className="text-sm text-muted-foreground">
                    {kind === "allergen" ? labels.allergenFilterHelp : labels.dietaryFilterHelp}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const checked = selected[kind].includes(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className={cn(
                            "inline-flex min-h-10 max-w-full cursor-pointer items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm",
                            menuLabelColorClasses(tag),
                            checked && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelected((current) => ({
                                ...current,
                                [kind]: checked
                                  ? [...current[kind], tag.id]
                                  : current[kind].filter((id) => id !== tag.id),
                              }));
                            }}
                          />
                          <MenuLabelBadge label={tag} className="px-0 py-0 text-sm" />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <output className="text-sm text-muted-foreground" aria-live="polite">
              {hasFilters && count === 0
                ? labels.noFilterMatches
                : `${labels.matchingItems}: ${count}`}
            </output>
            <button
              type="button"
              disabled={!hasFilters}
              className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setSelected({ allergen: [], dietary: [] })}
            >
              {labels.clearFilters}
            </button>
          </div>
        </div>
      ) : null}
      {sections.length === 0 ? <p className="text-muted-foreground">{labels.emptyMenu}</p> : null}
      {filteredSections.map((section) => (
        <section
          key={section.id}
          id={`${id}-category-${section.id}`}
          tabIndex={-1}
          className="scroll-mt-[calc(var(--menu-top-offset,0px)+4.5rem)] space-y-5 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={section.name}
        >
          <h2 className="border-b border-border pb-3 font-serif text-2xl font-semibold">
            {section.name}
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {section.items.map((item) => {
              const sizes = item.sizes ?? [];
              const selectedSize =
                sizes.find((size) => size.id === selectedSizes[item.id]) ?? sizes[0];
              return (
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
                        <output
                          aria-label={labels.price}
                          aria-live="polite"
                          className="font-semibold"
                        >
                          {formatter.format(
                            (selectedSize?.priceMinor ?? item.priceMinor) / divisor,
                          )}
                        </output>
                      </div>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                    {sizes.length ? (
                      <fieldset className="min-w-0 space-y-2">
                        <legend className="text-sm font-medium">{labels.sizes}</legend>
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((size) => {
                            const checked = selectedSize?.id === size.id;
                            return (
                              <label
                                key={size.id}
                                className={cn(
                                  "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
                                  checked
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:bg-accent hover:text-accent-foreground",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`${id}-size-${item.id}`}
                                  value={size.id}
                                  checked={checked}
                                  className="sr-only"
                                  onChange={() =>
                                    setSelectedSizes((current) => ({
                                      ...current,
                                      [item.id]: size.id,
                                    }))
                                  }
                                />
                                <span className="wrap-anywhere">{size.name}</span>
                                <span className="shrink-0 font-semibold">
                                  {formatter.format(size.priceMinor / divisor)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : null}
                    {(item.spiceLevel ?? 0) > 0 || item.labels.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <MenuSpiceBadge level={item.spiceLevel ?? 0} labels={labels} />
                        {(["allergen", "dietary"] as const).map((kind) => {
                          const tags = item.labels.filter((label) => label.kind === kind);
                          return tags.length ? (
                            <ul
                              key={kind}
                              aria-label={kind === "allergen" ? labels.allergens : labels.dietary}
                              className="contents"
                            >
                              {tags.map((tag) => (
                                <li key={tag.id} className="inline-flex max-w-full">
                                  <MenuLabelBadge label={tag} />
                                </li>
                              ))}
                            </ul>
                          ) : null;
                        })}
                      </div>
                    ) : null}
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
