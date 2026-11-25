import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { localeNames, locales, localeShort } from "@/lib/i18n/config";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";

export function PreviewLanguageSwitcher({
  languages = locales,
  translatedPath,
}: {
  languages?: readonly string[];
  translatedPath?: (code: string) => string | undefined;
}) {
  const location = useLocation();
  const { locale } = useShowroomParams();
  const previousLocale = useRef(locale);
  useEffect(() => {
    if (previousLocale.current !== locale) {
      document.cookie = `FORGE_LOCALE=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`;
      previousLocale.current = locale;
    }
  }, [locale]);

  const hrefs: Record<string, string> = {};
  for (const code of languages) {
    const path = translatedPath
      ? translatedPath(code)
      : location.pathname.replace(/^\/[^/]+/, `/${code}`);
    if (path) hrefs[code] = path + location.searchStr + (location.hash ? `#${location.hash}` : "");
  }
  const available = Object.keys(hrefs);
  if (available.length < 2) return null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span>Language</span>
      <LanguageSwitcher
        locale={locale}
        locales={available}
        localeNames={localeNames}
        localeShort={localeShort}
        localeHrefs={hrefs}
        linkComponent={ShowroomLink}
        className="min-h-10 rounded-lg border border-input bg-background hover:bg-accent"
      />
    </div>
  );
}
