import { useState } from "react";

import type { MenuFilters } from "./composed-public";
import { MenuLabelBadge } from "./label-badge";
import { MenuLabelOptions } from "./label-options";
import { getMenuFilterLabels } from "./label-presets";
import { menusLabels, type MenusLabels } from "./labels";
import { menuPriceFormatter } from "./price";
import { MenuPrintSymbols } from "./print-labels";
import { MenuSizePrices } from "./size-prices";
import { MenuSpiceBadge } from "./spice-badge";
import type { MenuCardView, MenuViewCategory, MenuViewLabel } from "./types";

const courses = ["starter", "main", "dessert"] as const;
const courseNames = {
  fr: { starter: "Entrées", main: "Plats", dessert: "Desserts" },
  en: { starter: "Starters", main: "Main courses", dessert: "Desserts" },
  de: { starter: "Vorspeisen", main: "Hauptgerichte", dessert: "Desserts" },
};

export function WeeklyMenu({
  data,
  locale,
  currency,
  currencyLabel = currency,
  labels: overrides,
  filterLabels,
  paper = false,
  filters,
  onFiltersChange,
}: {
  data: MenuCardView;
  locale: string;
  currency: string;
  currencyLabel?: string;
  labels?: Partial<MenusLabels>;
  filterLabels?: readonly MenuViewLabel[];
  paper?: boolean;
  filters?: MenuFilters;
  onFiltersChange?: (filters: MenuFilters) => void;
}) {
  const [localFilters, setLocalFilters] = useState<MenuFilters>({ allergen: [], dietary: [] });
  const selected = filters ?? localFilters;
  const labels = { ...menusLabels, ...overrides };
  const money = menuPriceFormatter(locale, currency);
  const hasPrices = data.categories.some((section) =>
    section.items.some((item) => item.priceMinor !== null || item.sizes?.length),
  );
  const options = getMenuFilterLabels(data.categories, locale, filterLabels);
  const lang = locale.startsWith("de") ? "de" : locale.startsWith("en") ? "en" : "fr";
  const days = [...(data.card.weekdays ?? [])].sort((a, b) => (a || 7) - (b || 7));
  const dayName = (day: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 7 + day)),
    );
  const category = (day: number, course: string) =>
    data.categories
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            paper ||
            (!item.labels.some(
              (label) => label.kind === "allergen" && selected.allergen.includes(label.id),
            ) &&
              selected.dietary.every((id) =>
                item.labels.some((label) => label.kind === "dietary" && label.id === id),
              )),
        ),
      }))
      .find(
        (section) =>
          section.id ===
          data.card.weeklySections?.find(
            (section) => section.day === day && section.course === course,
          )?.categoryId,
      );
  const content = (section: MenuViewCategory | undefined) =>
    section?.items.length ? (
      <ul className="space-y-3">
        {section.items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <p className="font-medium wrap-anywhere">{item.name}</p>
            {item.description && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                {item.description}
              </p>
            )}
            {(!!item.labels.length || !!item.spiceLevel) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {!!item.spiceLevel && (
                  <MenuSpiceBadge level={item.spiceLevel} labels={labels} iconOnly={paper} />
                )}
                {paper ? (
                  <MenuPrintSymbols labels={item.labels} />
                ) : (
                  item.labels.map((label) => <MenuLabelBadge key={label.id} label={label} />)
                )}
              </div>
            )}
            {item.soldOut && (
              <p className="mt-1 text-xs text-status-pending-foreground">{labels.soldOut}</p>
            )}
            {item.sizes?.length ? (
              <MenuSizePrices
                sizes={item.sizes}
                format={money}
                paper={paper}
                className="mt-1 text-sm"
              />
            ) : (
              item.priceMinor !== null && (
                <p className="mt-1 text-sm tabular-nums">{money(item.priceMinor)}</p>
              )
            )}
          </li>
        ))}
      </ul>
    ) : (
      <span
        aria-label={lang === "fr" ? "Aucun plat" : lang === "de" ? "Kein Gericht" : "No dish"}
        className="text-muted-foreground"
      >
        —
      </span>
    );
  return (
    <>
      {!paper && hasPrices && (
        <p className="mb-3 text-right text-sm text-muted-foreground">
          {labels.price} ({data.card.currencyLabel ?? currencyLabel})
        </p>
      )}
      {!paper && options.length > 0 && (
        <div className="mb-6 space-y-3 border-y border-border py-4">
          {(["allergen", "dietary"] as const).map((kind) => (
            <MenuLabelOptions
              key={kind}
              legend={
                kind === "allergen" ? (labels.excludeAllergens ?? labels.allergens) : labels.dietary
              }
              labels={options.filter((label) => label.kind === kind)}
              value={selected[kind]}
              onChange={(value) => {
                const next = { ...selected, [kind]: value };
                if (onFiltersChange) onFiltersChange(next);
                else setLocalFilters(next);
              }}
            />
          ))}
        </div>
      )}
      <div className={paper ? "" : "hidden md:block print:block"}>
        <table className="w-full table-fixed border-collapse text-left text-sm wrap-anywhere">
          <caption className="sr-only">{data.card.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 border-b border-border p-3">
                <span className="sr-only">{lang === "fr" ? "Service" : "Course"}</span>
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="border-b border-border p-3 font-semibold capitalize"
                >
                  {dayName(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course}>
                <th scope="row" className="border-b border-border p-3 align-top font-medium">
                  {courseNames[lang][course]}
                </th>
                {days.map((day) => (
                  <td key={day} className="border-b border-border p-3 align-top">
                    {content(category(day, course))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!paper && (
        <div className="space-y-8 md:hidden print:hidden">
          {days.map((day) => (
            <section key={day} className="space-y-4">
              <h3 className="border-b border-border pb-2 font-serif text-xl font-semibold capitalize">
                {dayName(day)}
              </h3>
              {courses.map((course) => (
                <div key={course} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                  <h4 className="text-sm text-muted-foreground">{courseNames[lang][course]}</h4>
                  <div className="text-sm">{content(category(day, course))}</div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
