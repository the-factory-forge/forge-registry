import { cn } from "@/components/utils/cn";

export const inputClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm";
export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";
export const primaryButtonClass = `${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`;
export const outlineButtonClass = `${buttonClass} border border-border hover:bg-accent`;
export const iconButtonClass = cn(
  buttonClass,
  "size-8 min-h-8 shrink-0 p-0 hover:bg-accent hover:text-accent-foreground",
);
export const dialogClass =
  "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border border-border bg-background p-6 text-foreground shadow-lg";
