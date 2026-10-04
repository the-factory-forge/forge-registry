"use client";

import { useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon, LayoutGridIcon } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { isLocale, localeNames, locales, localeShort } from "@/lib/i18n/config";
import { ShowroomLink as Link } from "@/showroom/routing";
import { ThemeControl } from "@/showroom/theme-control";

export function ShowroomHeader() {
  const location = useLocation();
  const isList = location.pathname === "/";
  const locale = location.pathname.split("/")[1];
  const Icon = isList ? LayoutGridIcon : ArrowLeftIcon;

  return (
    <header className="sticky top-0 z-40 h-(--showroom-header-height) shrink-0 border-b border-border bg-background text-foreground print:hidden">
      <nav aria-label="Showroom navigation" className="showroom-header-inner">
        <a
          href="#factory-showroom-preview"
          onClick={(event) => {
            event.preventDefault();
            const preview = document.getElementById("factory-showroom-preview");
            preview?.focus();
            preview?.scrollIntoView({ block: "start" });
          }}
          className="sr-only rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:z-50 focus:outline-2 focus:outline-ring"
        >
          Skip to preview
        </a>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <a
            href="https://the-corner.io/forge/intranet"
            className="inline-flex shrink-0 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img
              src="https://assets.the-corner.io/logos/the_corner-icon.svg"
              alt="The Corner"
              width={32}
              height={32}
              className="size-8 shrink-0 dark:invert"
            />
          </a>
          <Link
            href="/"
            aria-current={isList ? "page" : undefined}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3"
          >
            <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
            All components
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isLocale(locale) && (
            <LanguageSwitcher
              locale={locale}
              locales={locales}
              localeNames={localeNames}
              localeShort={localeShort}
              localeHrefs={Object.fromEntries(
                locales.map((nextLocale) => [
                  nextLocale,
                  location.href.replace(/^\/[^/]+/, `/${nextLocale}`),
                ]),
              )}
              onLocaleChange={(nextLocale) => {
                document.cookie = `FORGE_LOCALE=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
              }}
              linkComponent={Link}
              className="min-h-10 min-w-10 justify-center rounded-xl px-2 hover:bg-accent hover:text-accent-foreground [&_svg]:hidden sm:[&_svg]:block"
            />
          )}
          <ThemeControl />
          <a
            href="https://github.com/the-factory-forge/forge-registry"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="size-5" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </nav>
    </header>
  );
}
