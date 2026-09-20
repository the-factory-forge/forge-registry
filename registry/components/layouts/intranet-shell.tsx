"use client";

import type { ReactNode } from "react";

import {
  IntranetSidebar,
  IntranetSidebarInset,
  IntranetSidebarProvider,
  IntranetSidebarToggle,
  type IntranetSidebarProps,
  useIntranetSidebar,
} from "@/components/intranet-sidebar";
import { cn } from "@/components/utils/cn";

function ShellSidebarToggle({ label }: { label?: string }) {
  const { isMobile, open } = useIntranetSidebar();

  return (
    <IntranetSidebarToggle
      aria-label={label}
      className={cn(
        !isMobile &&
          open &&
          "fixed top-2 left-[13.5rem] z-30 border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
      )}
    />
  );
}

export interface IntranetShellProps extends Omit<
  IntranetSidebarProps,
  "togglePlacement" | "className"
> {
  /** Full banner content; the host owns its colors and spacing. */
  banner?: ReactNode;
  topbar?: ReactNode;
  /** Place the supplied toggle in your navbar; it moves beside the brand when expanded. */
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
  const toggle = <ShellSidebarToggle label={sidebarProps.labels?.toggle} />;

  return (
    <IntranetSidebarProvider>
      <IntranetSidebar
        {...sidebarProps}
        className={cn(showTopbar && "[&>header]:pr-12", sidebarClassName)}
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
