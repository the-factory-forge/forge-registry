import type { ReactNode } from "react";

export function PreviewControls({
  children,
  navigation,
}: {
  children?: ReactNode;
  navigation?: ReactNode;
}) {
  return (
    <aside
      aria-label="Preview controls"
      className="showroom-controls min-w-0 bg-background text-sm print:hidden"
    >
      <h2 className="mb-5 font-semibold">Preview controls</h2>
      {navigation && (
        <nav
          aria-label="Preview navigation"
          className="mb-5 flex flex-col items-start gap-3 border-b border-border pb-5 [&_a]:underline [&_a]:underline-offset-4"
        >
          {navigation}
        </nav>
      )}
      {children && (
        <div className="flex flex-col items-start gap-4 [&_button]:text-start [&_label]:max-w-full [&_label]:min-w-0 [&_label:has(select)]:flex [&_label:has(select)]:w-full [&_label:has(select)]:flex-col [&_label:has(select)]:items-start [&_label:has(select)]:gap-2 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:p-1">
          {children}
        </div>
      )}
    </aside>
  );
}
