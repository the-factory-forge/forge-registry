export const locales = ["fr", "en", "de", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};

export const localeShort: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  de: "DE",
  it: "IT",
};

export const ogLocales: Record<Locale, string> = {
  fr: "fr_CH",
  en: "en_US",
  de: "de_CH",
  it: "it_CH",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
