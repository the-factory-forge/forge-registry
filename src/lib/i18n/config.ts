export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export const localeShort: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};

export const ogLocales: Record<Locale, string> = {
  fr: "fr_CH",
  en: "en_US",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
