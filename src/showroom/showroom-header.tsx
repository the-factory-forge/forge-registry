"use client";

import { useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon, LayoutGridIcon } from "lucide-react";

import { ShowroomLink as Link } from "@/showroom/routing";

export function ShowroomHeader() {
  const isList = useLocation({ select: (location) => location.pathname }) === "/";
  const Icon = isList ? LayoutGridIcon : ArrowLeftIcon;

  return (
    <header className="sticky top-0 z-40 h-(--showroom-header-height) shrink-0 border-b border-border bg-background text-foreground print:hidden">
      <nav
        aria-label="Showroom navigation"
        className="mx-auto flex h-full max-w-[1536px] items-center justify-between gap-3 px-4 sm:px-6"
      >
        <Link
          href="/"
          aria-current={isList ? "page" : undefined}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon className="size-4" aria-hidden="true" />
          All components
        </Link>
        <span className="text-xs font-medium text-muted-foreground">Forge showroom</span>
      </nav>
    </header>
  );
}
