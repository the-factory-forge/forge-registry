/** Shared layout for plugin data tables, based on the employee directory. */
export const tablePanelClass =
  "min-w-0 rounded-xl border border-border bg-card p-6 text-card-foreground";
export const tableClass =
  "w-full min-w-[36rem] border-separate border-spacing-0 caption-bottom text-sm";
export const tableHeaderClass = "h-10 px-2 text-left align-middle font-medium whitespace-nowrap";
export const tableRowClass =
  "group border-b border-border hover:bg-muted/50 [&>*]:[border-bottom:inherit]";
export const tableCellClass = "p-2 align-middle";
export const tableActionCellClass =
  "w-px p-2 text-right align-middle whitespace-nowrap md:sticky md:right-0 md:z-10 md:bg-card/80 md:backdrop-blur-md md:group-hover:bg-muted/80";
export const tableActionHeaderClass = `${tableActionCellClass} h-10 font-medium`;
export const tableActionsClass = "flex items-center justify-end gap-2";
export const tableFooterClass = "mt-5 flex flex-wrap items-center justify-end gap-3";
