import type { ReactNode } from "react";

import { cn } from "@/components/utils/cn";

export function PreviewControls({
  children,
  navigation,
  label = "Preview controls",
  className,
}: {
  children: ReactNode;
  navigation?: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label={label}
      className={cn("min-w-0 rounded-xl border border-border bg-background text-sm", className)}
    >
      {navigation && (
        <nav
          aria-label={`${label} navigation`}
          className="flex flex-wrap gap-x-5 gap-y-3 border-b border-border p-4 [&_a]:underline [&_a]:underline-offset-4"
        >
          {navigation}
        </nav>
      )}
      <details>
        <summary className="cursor-pointer rounded-xl px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {label}
        </summary>
        <div className="flex flex-wrap items-center gap-4 px-4 pt-1 pb-4 [&_label]:min-w-0 [&_select]:max-w-full [&_select]:rounded-md [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:p-1">
          {children}
        </div>
      </details>
    </aside>
  );
}
