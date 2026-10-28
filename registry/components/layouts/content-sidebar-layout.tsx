import type { ReactNode } from "react";

import { cn } from "@/components/utils/cn";

export interface ContentSidebarLayoutProps {
  children: ReactNode;
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

/** The host supplies --intranet-top-offset when a header covers the viewport. */
export function ContentSidebarLayout({
  children,
  toolbar,
  sidebar,
  className,
}: ContentSidebarLayoutProps) {
  return (
    <div
      className={cn(
        "@container/content-sidebar grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6",
        className,
      )}
    >
      {(toolbar || sidebar) && (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-6",
            sidebar &&
              "@min-[64rem]/content-sidebar:sticky @min-[64rem]/content-sidebar:top-[calc(var(--intranet-top-offset,0rem)+1rem)] @min-[64rem]/content-sidebar:col-start-2 @min-[64rem]/content-sidebar:row-start-1 @min-[64rem]/content-sidebar:max-h-[calc(100dvh-var(--intranet-top-offset,0rem)-2rem)] @min-[64rem]/content-sidebar:w-[22rem] @min-[64rem]/content-sidebar:self-start",
          )}
        >
          {toolbar && <div className="shrink-0">{toolbar}</div>}
          {sidebar && (
            <div className="min-w-0 @min-[64rem]/content-sidebar:min-h-0 @min-[64rem]/content-sidebar:overflow-y-auto">
              {sidebar}
            </div>
          )}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
