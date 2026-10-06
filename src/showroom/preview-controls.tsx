import type { ReactNode } from "react";

export function PreviewControls({
  children,
  navigation,
  notice,
}: {
  children?: ReactNode;
  navigation?: ReactNode;
  notice?: ReactNode;
}) {
  return (
    <aside
      aria-label="Preview controls"
      className="showroom-controls min-w-0 bg-primary/5 text-sm print:hidden"
    >
      <h2 className="text-base font-semibold">Preview controls</h2>
      <p className="mt-1 mb-6 leading-relaxed text-muted-foreground">Adjust this example.</p>
      {navigation && (
        <nav
          aria-label="Preview navigation"
          className="mb-6 flex flex-col items-start gap-3 border-b border-border pb-6 [&_a]:rounded-sm [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-ring"
        >
          {navigation}
        </nav>
      )}
      {children && (
        <div className="flex flex-col items-start gap-5 [&_button]:text-start [&_label]:max-w-full [&_label]:min-w-0 [&_label:has(select)]:flex [&_label:has(select)]:w-full [&_label:has(select)]:flex-col [&_label:has(select)]:items-start [&_label:has(select)]:gap-2 [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-lg [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_select]:text-base [&_select]:text-foreground [&_select]:shadow-xs [&_select]:focus-visible:outline-2 [&_select]:focus-visible:outline-offset-2 [&_select]:focus-visible:outline-ring sm:[&_select]:text-sm">
          {children}
        </div>
      )}
      {notice && (
        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          {notice}
        </p>
      )}
    </aside>
  );
}
