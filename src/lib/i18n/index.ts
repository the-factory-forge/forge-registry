import { defaultLocale, type Locale } from "./config";

// oxlint-disable-next-line typescript/no-explicit-any
export type Dictionary = Record<string, any>;

const dictionaries: Record<string, () => Promise<Dictionary>> = {
  fr: () => import("./fr.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
  de: () => import("./de.json").then((m) => m.default),
  it: () => import("./it.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries[defaultLocale];
  return loader();
}

export function t(dictionary: Dictionary, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);

  return typeof value === "string" ? value : key;
}

export function tList(dictionary: Dictionary, key: string): string[] {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);

  return Array.isArray(value) ? (value as string[]) : [];
}

export function tNode<T = unknown>(dictionary: Dictionary, key: string): T | undefined {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);

  return value as T | undefined;
}

export {
  type Locale,
  locales,
  defaultLocale,
  localeNames,
  localeShort,
  ogLocales,
  isLocale,
} from "./config";
