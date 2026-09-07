"use client";

import { Globe, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/forge/ui/dropdown-menu";
import { Link } from "@/components/forge/ui/link";
import { usePathname } from "@/components/forge/ui/use-location";
import { cn } from "@/lib/forge/utils";

export interface LanguageSwitcherProps {
  locale: string;
  locales: string[];
  localeNames: Record<string, string>;
  localeShort: Record<string, string>;
  ariaLabel?: string;
  className?: string;
}

export function LanguageSwitcher({
  locale,
  locales,
  localeNames,
  localeShort,
  ariaLabel = "Language",
  className,
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
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{localeShort[locale] ?? locale.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((l) => (
          <DropdownMenuItem key={l} asChild className="justify-between">
            <Link href={`/${l}${pathnameWithoutLocale}`}>
              {localeNames[l] ?? l}
              {l === locale && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
