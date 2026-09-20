"use client";

import { GlobeIcon, CheckIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { Link } from "@/components/link";
import { cn } from "@/components/utils/cn";
import { usePathname } from "@/components/utils/use-location";

export interface LanguageSwitcherProps {
  locale: string;
  locales: readonly string[];
  localeNames: Record<string, string>;
  localeShort: Record<string, string>;
  ariaLabel?: string;
  className?: string;
  search?: string;
  /** Translated routes, including localized slugs, supplied by the host. */
  localeHrefs?: Record<string, string>;
  onLocaleChange?: (locale: string) => void;
}

export function LanguageSwitcher({
  locale,
  locales,
  localeNames,
  localeShort,
  ariaLabel = "Language",
  className,
  search = "",
  localeHrefs,
  onLocaleChange,
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const pathnameWithoutLocale = pathname.replace(new RegExp(`^/(${locales.join("|")})`), "") || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <GlobeIcon className="h-4 w-4" aria-hidden="true" />
        <span>{localeShort[locale] ?? locale.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((l) => (
          <DropdownMenuItem key={l} asChild className="justify-between">
            <Link
              href={localeHrefs?.[l] ?? `/${l}${pathnameWithoutLocale}${search}`}
              onClick={() => onLocaleChange?.(l)}
              aria-current={l === locale ? "true" : undefined}
            >
              {localeNames[l] ?? l}
              {l === locale && <CheckIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
