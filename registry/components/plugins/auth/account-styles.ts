export const accountCardClass =
  "min-w-0 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6";
export const accountButtonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
export const accountPrimaryClass =
  "border-transparent bg-primary text-primary-foreground hover:bg-primary/90";
export const accountInputClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm";
export const accountDialogClass =
  "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 scroll-py-32 overflow-y-auto rounded-2xl border border-border bg-popover px-6 text-popover-foreground shadow-lg";
export function accountDate(value: Date | string, locale?: string) {
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
