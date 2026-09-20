"use client";

import { useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon, LayoutGridIcon } from "lucide-react";

import { ShowroomLink as Link } from "@/showroom/routing";
import { ThemeControl } from "@/showroom/theme-control";

export function ShowroomHeader() {
  const isList = useLocation({ select: (location) => location.pathname }) === "/";
  const Icon = isList ? LayoutGridIcon : ArrowLeftIcon;

  return (
    <header className="sticky top-0 z-40 h-(--showroom-header-height) shrink-0 border-b border-border bg-background text-foreground print:hidden">
      <nav aria-label="Showroom navigation" className="showroom-header-inner">
        <a
          href="#showroom-preview"
          onClick={(event) => {
            event.preventDefault();
            const preview = document.getElementById("showroom-preview");
            preview?.focus();
            preview?.scrollIntoView({ block: "start" });
          }}
          className="sr-only rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:z-50 focus:outline-2 focus:outline-ring"
        >
          Skip to preview
        </a>
        <Link
          href="/"
          aria-current={isList ? "page" : undefined}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon className="size-4" aria-hidden="true" />
          All components
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
