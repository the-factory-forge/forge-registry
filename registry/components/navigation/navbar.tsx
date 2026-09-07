/* oxlint-disable nextjs/no-img-element -- img brut volontaire (registry framework-agnostic) */
"use client";

import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

import { LanguageSwitcher } from "@/components/forge/navigation/language-switcher";
import { CtaExternal } from "@/components/forge/ui/cta-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/forge/ui/dropdown-menu";
import { Link } from "@/components/forge/ui/link";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/forge/ui/sheet";
import { usePathname } from "@/components/forge/ui/use-location";
import { cn } from "@/lib/forge/utils";

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface NavbarProps {
  logo: { src?: string; alt: string; href: string; initial?: string };
  items: NavItem[];
  cta: { label: string; href: string };
  /** Optional login link (auth enabled) - desktop beside CTA, mobile below it. */
  loginHref?: string;
  loginLabel?: string;
  locale: string;
  locales: string[];
  localeNames: Record<string, string>;
  localeShort: Record<string, string>;
  siteName: string;
  menuLabel?: string;
  languageLabel?: string;
  closeLabel?: string;
  navLabel?: string;
  mobileNavLabel?: string;
  controls?: React.ReactNode;
}

export function Navbar({
  logo,
  items,
  cta,
  loginHref,
  loginLabel,
  locale,
  locales,
  localeNames,
  localeShort,
  siteName,
  menuLabel = "Menu",
  languageLabel = "Language",
  closeLabel = "Close",
  navLabel = "Main navigation",
  mobileNavLabel = "Mobile navigation",
  controls,
}: NavbarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === `/${locale}`) return pathname === `/${locale}`;
    return pathname.startsWith(href);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors",
        scrolled
          ? "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          : "border-transparent bg-background",
      )}
    >
      <div className="container-premium flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link
          href={logo.href}
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {logo.src ? (
            <img src={logo.src} alt={logo.alt} className="h-9 w-auto" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {logo.initial ?? siteName.charAt(0)}
            </span>
          )}
          <span className="text-lg font-bold tracking-tight text-foreground">{siteName}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={navLabel}>
          {items.map((item) =>
            item.children && item.children.length > 0 ? (
              <DropdownMenu key={item.href}>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  {item.label}
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {item.children.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link href={child.href}>{child.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          {controls}

          <LanguageSwitcher
            locale={locale}
            locales={locales}
            localeNames={localeNames}
            localeShort={localeShort}
            ariaLabel={languageLabel}
          />

          <CtaExternal href={cta.href} className="hidden md:inline-flex">
            {cta.label}
          </CtaExternal>

          {loginHref && (
            <Link
              href={loginHref}
              className="hidden border-l border-border pl-3 text-sm font-medium text-foreground/70 transition-colors hover:text-primary md:inline-flex"
            >
              {loginLabel}
            </Link>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              aria-label={menuLabel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} className="w-full max-w-sm p-0">
              <SheetTitle className="sr-only">{menuLabel}</SheetTitle>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <span className="text-lg font-bold text-foreground">{siteName}</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={closeLabel}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav
                className="flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto px-5 py-6"
                aria-label={mobileNavLabel}
              >
                {items.map((item) => (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-2xl px-4 py-3 font-medium transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                    {item.children?.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-2xl py-3 pr-4 pl-8 text-sm font-medium text-foreground/80 transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <CtaExternal href={cta.href} size="lg" className="mt-4 w-full">
                  {cta.label}
                </CtaExternal>
                {loginHref && (
                  <Link
                    href={loginHref}
                    onClick={() => setMobileOpen(false)}
                    className="mt-4 block border-t border-border pt-4 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    {loginLabel}
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <nav className="hidden" aria-label={mobileNavLabel}>
        {items.map((item) => (
          <span key={item.href}>
            <Link href={item.href}>{item.label}</Link>
            {item.children?.map((child) => (
              <Link key={child.href} href={child.href}>
                {child.label}
              </Link>
            ))}
          </span>
        ))}
        <Link href={cta.href}>{cta.label}</Link>
        {loginHref && <Link href={loginHref}>{loginLabel}</Link>}
      </nav>
    </header>
  );
}
