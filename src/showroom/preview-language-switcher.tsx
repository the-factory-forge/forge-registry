import { useLocation } from "@tanstack/react-router";
import { GlobeIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { localeNames, localeShort, type Locale } from "@/lib/i18n/config";
import { ShowroomLink, useShowroomParams } from "@/showroom/routing";

export function PreviewLanguageSwitcher({
  translatedPath,
}: {
  translatedPath?: (code: Locale) => string | undefined;
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

  const alternate = locale === "en" ? "fr" : "en";
  const path = translatedPath
    ? translatedPath(alternate)
    : location.pathname.replace(/^\/[^/]+/, `/${alternate}`);
  if (!path) return null;
  const href = path + location.searchStr + (location.hash ? `#${location.hash}` : "");

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span>Language</span>
      <ShowroomLink
        href={href}
        hrefLang={alternate}
        aria-label={`${localeShort[alternate]}, switch language to ${localeNames[alternate]}`}
        className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-2 text-sm font-medium text-foreground/80 transition-colors outline-none hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GlobeIcon className="size-4" aria-hidden="true" />
        {localeShort[alternate]}
      </ShowroomLink>
    </div>
  );
}
