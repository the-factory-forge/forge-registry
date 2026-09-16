"use client";

import type { ReactNode } from "react";

import {
  IntranetSidebar,
  IntranetSidebarInset,
  IntranetSidebarProvider,
  IntranetSidebarToggle,
  type IntranetSidebarProps,
} from "@/components/forge/navigation/intranet-sidebar";
import { cn } from "@/lib/forge/utils";

export interface IntranetShellProps extends Omit<
  IntranetSidebarProps,
  "togglePlacement" | "className"
> {
  /** Full banner content; the host owns its colors and spacing. */
  banner?: ReactNode;
  topbar?: ReactNode;
  /** Replace the complete topbar, placing the supplied toggle in your navbar. */
  renderTopbar?: (toggle: ReactNode) => ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
  /** Hide the topbar and keep the sidebar's standalone toggle available. */
  showTopbar?: boolean;
  className?: string;
  contentClassName?: string;
  sidebarClassName?: string;
  /** Use div when the page already provides its main landmark. */
  insetAs?: "main" | "div";
  /** Disable the content wrapper when the host owns page spacing and print layout. */
  wrapContent?: boolean;
}

export function IntranetShell({
  banner,
  topbar,
  renderTopbar,
  controls,
  children,
  showTopbar = true,
  className,
  contentClassName,
  sidebarClassName,
  insetAs = "main",
  wrapContent = true,
  ...sidebarProps
}: IntranetShellProps) {
  const toggle = <IntranetSidebarToggle aria-label={sidebarProps.labels?.toggle} />;

  return (
    <IntranetSidebarProvider>
      <IntranetSidebar
        {...sidebarProps}
        className={sidebarClassName}
        togglePlacement={showTopbar ? "external" : "sidebar"}
      />
      <IntranetSidebarInset
        as={insetAs}
        className={cn(!showTopbar && "pt-12 print:pt-0", className)}
      >
        {banner && <div className="print:hidden">{banner}</div>}
        {showTopbar &&
          (renderTopbar ? (
            renderTopbar(toggle)
          ) : (
            <header className="flex min-h-14 items-center gap-2 border-b border-border px-4 py-2 print:hidden">
              {toggle}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {topbar ?? (
                  <span className="truncate text-sm font-medium">{sidebarProps.brand.name}</span>
                )}
              </div>
              {controls && <div className="ml-auto flex items-center gap-2">{controls}</div>}
            </header>
          ))}
        {wrapContent ? (
          <div
            data-slot="intranet-content"
            className={cn("flex-1 p-4 sm:p-6 print:p-0", contentClassName)}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </IntranetSidebarInset>
    </IntranetSidebarProvider>
  );
}
