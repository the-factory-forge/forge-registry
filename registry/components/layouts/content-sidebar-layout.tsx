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
        "grid min-w-0 gap-6",
        sidebar && "lg:grid-cols-[minmax(0,1fr)_22rem]",
        className,
      )}
    >
      {(toolbar || sidebar) && (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-6",
            sidebar &&
              "lg:sticky lg:top-[calc(var(--intranet-top-offset,0rem)+1rem)] lg:order-last lg:max-h-[calc(100dvh-var(--intranet-top-offset,0rem)-2rem)] lg:self-start",
          )}
        >
          {toolbar && <div className="shrink-0">{toolbar}</div>}
          {sidebar && <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto">{sidebar}</div>}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
