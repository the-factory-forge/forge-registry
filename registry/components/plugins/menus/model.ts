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
const position = (value: number) => fail(Number.isSafeInteger(value) && value >= 0);

export function validateTranslations(
  input: Record<string, string | MenuTranslation>,
  baseLocale: string,
  withDescription: boolean,
) {
  fail(input && typeof input === "object" && !Array.isArray(input));
  const result: Record<string, string | MenuTranslation> = {};
  for (const [locale, value] of Object.entries(input)) {
    fail(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(locale));
    if (withDescription) {
      fail(value && typeof value === "object" && !Array.isArray(value));
      const translation = value as MenuTranslation;
      fail(typeof translation.name === "string" && typeof translation.description === "string");
      fail(translation.name.trim().length <= 200 && translation.description.trim().length <= 2000);
      result[locale] = {
        name: translation.name.trim(),
        description: translation.description.trim(),
      };
    } else {
      fail(typeof value === "string" && value.trim().length <= 120);
      result[locale] = (value as string).trim();
    }
  }
  const base = result[baseLocale];
  fail(withDescription ? !!(base as MenuTranslation | undefined)?.name : !!base);
  return result;
}

export function validateItem(input: MenuItemInput, baseLocale: string) {
  fail(input && typeof input === "object");
  fail(typeof input.categoryId === "string" && !!input.categoryId);
  fail(Number.isSafeInteger(input.priceMinor) && input.priceMinor >= 0 && input.priceMinor <= 1e9);
  position(input.position);
  fail(typeof input.visible === "boolean" && typeof input.soldOut === "boolean");
  fail(input.imageEntryId === null || typeof input.imageEntryId === "string");
  fail(Array.isArray(input.labelIds) && input.labelIds.length <= 40);
  fail(input.labelIds.every((id) => typeof id === "string" && !!id));
  fail(new Set(input.labelIds).size === input.labelIds.length);
  return {
    ...input,
    translations: validateTranslations(input.translations, baseLocale, true) as Record<
      string,
      MenuTranslation
    >,
  };
}

export function validateCategory(input: MenuCategoryInput, baseLocale: string) {
  position(input.position);
  return {
    position: input.position,
    translations: validateTranslations(input.translations, baseLocale, false) as Record<
      string,
      string
    >,
  };
}

export function validateLabel(input: MenuLabelInput, baseLocale: string) {
  fail(input.kind === "allergen" || input.kind === "dietary");
  position(input.position);
  return {
    kind: input.kind,
    position: input.position,
    translations: validateTranslations(input.translations, baseLocale, false) as Record<
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
            position: item.position,
            visible: item.visible,
            soldOut: item.soldOut,
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
