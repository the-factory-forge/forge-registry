import { z } from "zod";

import { menuLabelIcons } from "@/components/plugins/menus/label-presets";
import type {
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenuLabelInput,
  MenuTranslation,
  MenuViewCategory,
} from "@/components/plugins/menus/types";

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
  categoryId: z.string().min(1),
  priceMinor: price,
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
export const menuCategoryInputSchema = z.object({ position, translations: names });
export const menuLabelInputSchema = menuCategoryInputSchema.extend({
  kind: z.enum(["allergen", "dietary"]),
  icon: z.enum(menuLabelIcons).nullish(),
});
export const menuOrderSchema = z.array(
  z.object({
    id: z.string(),
    version: z.number().int().positive(),
  }),
);
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
