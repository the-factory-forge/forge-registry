import { SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";

export function PreviewControls({
  children,
  open,
  onToggle,
  navigation,
  notice,
}: {
  children?: ReactNode;
  open: boolean;
  onToggle: () => void;
  navigation?: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <aside
      aria-label="Preview controls"
      className={cn("showroom-controls min-w-0 text-sm print:hidden", open && "bg-primary/5")}
    >
      <div className="flex items-center justify-end gap-2">
        <h2 hidden={!open} className="me-auto text-base font-semibold">
          Preview controls
        </h2>
        <IconTooltip label="Settings">
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={open}
            aria-controls="factory-showroom-controls"
            onClick={onToggle}
            className={cn(
              "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              open
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-background text-foreground hover:bg-primary/5 hover:text-primary",
            )}
          >
            <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      <div id="factory-showroom-controls" hidden={!open}>
        <p className="mt-1 mb-6 leading-relaxed text-muted-foreground">Adjust this example.</p>
        {navigation && (
          <nav
            aria-label="Preview navigation"
            className="mb-6 flex flex-col items-start gap-3 border-b border-border pb-6 [&_a]:rounded-sm [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-ring [&_a[aria-current=page]]:font-bold"
          >
            {navigation}
          </nav>
        )}
        {children && (
          <div className="flex flex-col items-start gap-5 [&_button]:text-start [&_label]:max-w-full [&_label]:min-w-0 [&_label:has(select)]:flex [&_label:has(select)]:w-full [&_label:has(select)]:flex-col [&_label:has(select)]:items-start [&_label:has(select)]:gap-2 [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-lg [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:py-2 [&_select]:ps-3 [&_select]:text-base [&_select]:text-foreground [&_select]:shadow-xs [&_select]:focus-visible:outline-2 [&_select]:focus-visible:outline-offset-2 [&_select]:focus-visible:outline-ring sm:[&_select]:text-sm">
            {children}
          </div>
        )}
        {notice && (
          <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </aside>
  );
}
