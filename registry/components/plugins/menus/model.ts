import { z } from "zod";

import { menuLabelIcons } from "@/components/plugins/menus/label-presets";
import { menuKinds, weeklyCourses } from "@/components/plugins/menus/types";
import type {
  MenuCard,
  MenuCardView,
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemGroupOrder,
  MenuItemInput,
  MenuLabel,
  MenuLabelInput,
  MenuTranslation,
  MenuViewCategory,
} from "@/components/plugins/menus/types";

export { menuKinds, weeklyCourses };

export type MenuErrorCode =
  | "INVALID"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "IN_USE"
  | "STORAGE";
export class MenuError extends Error {
  readonly code: MenuErrorCode;
  constructor(code: MenuErrorCode) {
    super(code);
    this.name = "MenuError";
    this.code = code;
  }
}

const fail = (condition: unknown) => {
  if (!condition) throw new MenuError("INVALID");
};
const position = z.number().int().nonnegative();
const price = position.max(1e9);
const localeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/);
const names = z.record(localeSchema, z.string().trim().max(120));
const translations = z.record(
  localeSchema,
  z.object({
    name: z.string().trim().max(200),
    description: z.string().trim().max(2000),
  }),
);
export const menuItemInputSchema = z.object({
  categoryId: z.string().min(1).nullable(),
  priceMinor: price.nullable(),
  sizes: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(120)
          .refine((value) => !!value.trim()),
        priceMinor: price,
        translations: names,
      }),
    )
    .max(20)
    .optional(),
  position,
  visible: z.boolean(),
  soldOut: z.boolean(),
  spiceLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  imageEntryId: z.string().nullable(),
  labelIds: z.array(z.string().min(1)).max(40),
  translations,
});
export const menuCategoryInputSchema = z.object({
  position,
  translations: names,
  descriptions: z.record(localeSchema, z.string().trim().max(2000)).optional(),
});
export const menuLabelInputSchema = z.object({
  position,
  translations: names,
  kind: z.enum(["allergen", "dietary"]),
  icon: z.enum(menuLabelIcons).nullish(),
});
export const menuOrderSchema = z.array(
  z.object({
    id: z.string(),
    version: z.number().int().positive(),
  }),
);
export const menuItemGroupOrderSchema = z
  .array(z.object({ categoryId: z.string().min(1), items: menuOrderSchema.max(1500) }))
  .min(1)
  .max(2)
  .refine((groups) => new Set(groups.map((group) => group.categoryId)).size === groups.length);
export function parseMenuInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new MenuError("INVALID");
  return result.data;
}
export function validateTranslations(
  input: Record<string, string | MenuTranslation>,
  baseLocale: string,
  withDescription: boolean,
) {
  const result = withDescription
    ? parseMenuInput(translations, input)
    : parseMenuInput(names, input);
  const base = result[baseLocale];
  fail(withDescription ? !!(base as MenuTranslation | undefined)?.name : !!base);
  return result;
}

export function validateItem(input: MenuItemInput, baseLocale: string) {
  const value = parseMenuInput(menuItemInputSchema, input);
  const sizes = (value.sizes ?? []).map((size) => ({
    ...size,
    translations: validateTranslations(size.translations, baseLocale, false) as Record<
      string,
      string
    >,
  }));
  fail(new Set(sizes.map((size) => size.id)).size === sizes.length);
  fail(new Set(value.labelIds).size === value.labelIds.length);
  return {
    ...value,
    priceMinor: sizes[0]?.priceMinor ?? value.priceMinor,
    sizes,
    spiceLevel: value.spiceLevel ?? 0,
    translations: validateTranslations(value.translations, baseLocale, true) as Record<
      string,
      MenuTranslation
    >,
  };
}

export function validateCategory(input: MenuCategoryInput, baseLocale: string) {
  const value = parseMenuInput(menuCategoryInputSchema, input);
  return {
    ...value,
    translations: validateTranslations(value.translations, baseLocale, false) as Record<
      string,
      string
    >,
  };
}

export function reorderMenuItems(
  items: readonly MenuItem[],
  order: readonly Pick<MenuItem, "id" | "version">[],
): MenuItem[] {
  order = parseMenuInput(menuOrderSchema, order);
  fail(new Set(order.map((entry) => entry.id)).size === order.length);
  if (order.length !== items.length) throw new MenuError("CONFLICT");
  const byId = new Map(items.map((item) => [item.id, item]));
  return order.map(({ id, version }, position) => {
    const item = byId.get(id);
    if (!item || item.version !== version) throw new MenuError("CONFLICT");
    return item.position === position ? item : { ...item, position, version: version + 1 };
  });
}

export function placeMenuItems(
  items: readonly MenuItem[],
  groups: readonly MenuItemGroupOrder[],
): MenuItem[] {
  groups = parseMenuInput(menuItemGroupOrderSchema, groups);
  const categoryIds = new Set(groups.map((group) => group.categoryId));
  const affected = items.filter(
    (item) => item.categoryId !== null && categoryIds.has(item.categoryId),
  );
  const order = groups.flatMap((group) => group.items);
  if (
    order.length !== affected.length ||
    new Set(order.map((item) => item.id)).size !== order.length
  )
    throw new MenuError("CONFLICT");
  const byId = new Map(affected.map((item) => [item.id, item]));
  return groups.flatMap(({ categoryId, items }) =>
    items.map(({ id, version }, position) => {
      const item = byId.get(id);
      if (!item || item.version !== version) throw new MenuError("CONFLICT");
      return item.categoryId === categoryId && item.position === position
        ? item
        : { ...item, categoryId, position, version: version + 1 };
    }),
  );
}

export function validateLabel(input: MenuLabelInput, baseLocale: string) {
  const value = parseMenuInput(menuLabelInputSchema, input);
  return {
    ...value,
    icon: value.icon ?? null,
    translations: validateTranslations(value.translations, baseLocale, false) as Record<
      string,
      string
    >,
  };
}

export function localized<T>(translations: Record<string, T>, locale: string, baseLocale: string) {
  const value = translations[locale];
  if (typeof value === "string") return (value.trim() ? value : translations[baseLocale]) as T;
  if (value && typeof value === "object" && "name" in value && typeof value.name === "string")
    return (value.name.trim() ? value : translations[baseLocale]) as T;
  return value || translations[baseLocale];
}

export function parsePrice(input: string, fractionDigits: number) {
  fail(Number.isInteger(fractionDigits) && fractionDigits >= 0 && fractionDigits <= 3);
  fail(
    new RegExp(fractionDigits ? `^\\d+(?:\\.\\d{1,${fractionDigits}})?$` : "^\\d+$").test(input),
  );
  const [whole, fraction = ""] = input.split(".");
  const amount =
    Number(whole) * 10 ** fractionDigits + Number(fraction.padEnd(fractionDigits, "0"));
  fail(Number.isSafeInteger(amount) && amount <= 1e9);
  return amount;
}

export function buildMenu(
  items: readonly MenuItem[],
  categories: readonly MenuCategory[],
  labels: readonly MenuLabel[],
  locale: string,
  baseLocale: string,
): MenuViewCategory[] {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  return [...categories]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((category) => ({
      id: category.id,
      name: localized(category.translations, locale, baseLocale),
      ...(category.descriptions && {
        description: localized(category.descriptions, locale, baseLocale),
      }),
      items: items
        .filter((item) => item.visible && item.categoryId === category.id)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map((item) => {
          const translation = localized(item.translations, locale, baseLocale);
          return {
            id: item.id,
            version: item.version,
            categoryId: item.categoryId,
            priceMinor: item.priceMinor,
            sizes: (item.sizes ?? []).map((size) => ({
              id: size.id,
              priceMinor: size.priceMinor,
              name: localized(size.translations, locale, baseLocale),
            })),
            position: item.position,
            visible: item.visible,
            soldOut: item.soldOut,
            spiceLevel: item.spiceLevel ?? 0,
            imageEntryId: item.imageEntryId,
            name: translation.name,
            description: translation.description,
            labels: item.labelIds.flatMap((id) => {
              const label = labelsById.get(id);
              return label
                ? [
                    {
                      id,
                      kind: label.kind,
                      ...(label.icon ? { icon: label.icon } : {}),
                      name: localized(label.translations, locale, baseLocale),
                    },
                  ]
                : [];
            }),
          };
        }),
    }))
    .filter((category) => category.items.length > 0);
}

const weekdaysSchema = z.array(z.number().int().min(0).max(6)).max(7);

export const menuCardInputSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    position,
    translations,
    categoryIds: z.array(z.uuid()).max(500),
    published: z.boolean(),
    displayMode: z.enum(["lines", "photos"]),
    startDate: z.iso.date().nullable(),
    endDate: z.iso.date().nullable(),
    kind: z.enum(menuKinds).optional(),
    weekdays: weekdaysSchema.optional(),
    weeklySections: z
      .array(
        z.object({
          categoryId: z.uuid(),
          day: z.number().int().min(0).max(6),
          course: z.enum(weeklyCourses),
        }),
      )
      .max(21)
      .optional(),
    currencyLabel: z.string().trim().min(1).max(16).optional(),
  })
  .refine((card) => Boolean(card.id) === Boolean(card.version))
  .refine((card) => card.id !== undefined || !card.published)
  .refine((card) => new Set(card.categoryIds).size === card.categoryIds.length)
  .refine((card) => !card.weekdays || new Set(card.weekdays).size === card.weekdays.length)
  .refine((card) => !card.startDate || !card.endDate || card.startDate <= card.endDate);

export function menuCardStatus(
  card: Pick<MenuCard, "published" | "startDate" | "endDate">,
  date: string,
): "unpublished" | "scheduled" | "live" | "ended" {
  if (!card.published) return "unpublished";
  if (card.startDate && date < card.startDate) return "scheduled";
  if (card.endDate && date > card.endDate) return "ended";
  return "live";
}

export function isMenuCardPublic(card: MenuCard, date: string) {
  return menuCardStatus(card, date) === "live";
}

export function nextWeekDates(endDate: string, weekdays: readonly number[]) {
  const value = parseMenuInput(z.iso.date(), endDate);
  const days = parseMenuInput(weekdaysSchema.min(1), weekdays);
  const end = new Date(`${value}T12:00:00Z`);
  const monday = end.getUTCDate() + 7 - ((end.getUTCDay() + 6) % 7);
  const offsets = days.map((day) => (day + 6) % 7);
  const dateAt = (offset: number) => {
    const date = new Date(end);
    date.setUTCDate(monday + offset);
    return date.toISOString().slice(0, 10);
  };
  return { startDate: dateAt(Math.min(...offsets)), endDate: dateAt(Math.max(...offsets)) };
}

export function visibleMenuCategoryIds(
  card: Pick<MenuCard, "kind" | "categoryIds" | "weekdays" | "weeklySections">,
) {
  if (card.kind !== "weekly") return card.categoryIds;
  const active = new Set(
    card.weeklySections
      ?.filter(({ day }) => card.weekdays?.includes(day))
      .map(({ categoryId }) => categoryId),
  );
  return card.categoryIds.filter((id) => active.has(id));
}

export function buildMenuCard(
  card: MenuCard,
  items: readonly MenuItem[],
  categories: readonly MenuCategory[],
  labels: readonly MenuLabel[],
  locale: string,
  baseLocale: string,
): MenuCardView {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ordered = visibleMenuCategoryIds(card).flatMap((id, position) => {
    const category = byId.get(id);
    return category ? [{ ...category, position }] : [];
  });
  const { id, displayMode, startDate, endDate, kind, weekdays, weeklySections, currencyLabel } =
    card;
  const translation = localized(card.translations, locale, baseLocale);
  return {
    card: {
      id,
      displayMode,
      startDate,
      endDate,
      kind,
      weekdays,
      weeklySections,
      currencyLabel,
      ...translation,
    },
    categories: buildMenu(items, ordered, labels, locale, baseLocale),
  };
}
