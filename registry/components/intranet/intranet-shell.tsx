"use client";

import type { ReactNode } from "react";

import {
  BackOfficeSidebar,
  BackOfficeSidebarInset,
  BackOfficeSidebarProvider,
  BackOfficeSidebarToggle,
  type BackOfficeSidebarProps,
} from "@/components/forge/navigation/back-office-sidebar";
import { cn } from "@/lib/forge/utils";

export interface IntranetShellProps extends Omit<
  BackOfficeSidebarProps,
  "togglePlacement" | "className"
> {
  banner?: ReactNode;
  topbar?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
  /** Hide the topbar and keep the sidebar's standalone toggle available. */
  showTopbar?: boolean;
  className?: string;
  contentClassName?: string;
}

export function IntranetShell({
  banner,
  topbar,
  controls,
  children,
  showTopbar = true,
  className,
  contentClassName,
  ...sidebarProps
}: IntranetShellProps) {
  return (
    <BackOfficeSidebarProvider>
      <BackOfficeSidebar {...sidebarProps} togglePlacement={showTopbar ? "external" : "sidebar"} />
      <BackOfficeSidebarInset className={cn(!showTopbar && "pt-12", className)}>
        {banner && <div className="border-b border-border px-4 py-2">{banner}</div>}
        {showTopbar && (
          <header className="flex min-h-14 items-center gap-2 border-b border-border px-4 py-2">
            <BackOfficeSidebarToggle aria-label={sidebarProps.labels?.toggle} />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {topbar ?? (
                <span className="truncate text-sm font-medium">{sidebarProps.brand.name}</span>
              )}
            </div>
            {controls && <div className="ml-auto flex items-center gap-2">{controls}</div>}
          </header>
        )}
        <div className={cn("flex-1 p-4 sm:p-6", contentClassName)}>{children}</div>
      </BackOfficeSidebarInset>
    </BackOfficeSidebarProvider>
  );
}
