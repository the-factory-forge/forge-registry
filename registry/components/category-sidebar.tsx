"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import type { LinkProps } from "@/components/link";
import { cn } from "@/components/utils/cn";
import { usePanelPreference } from "@/components/utils/view-preference";

export type CategorySidebarProps = {
  categories: readonly { id: string; parentId?: string | null; label: string }[];
  categoryId?: string;
  title: string;
  navigationLabel: string;
  clearLabel: string;
  preferenceKey: string;
} & (
  | { categoryHref: (id: string | null) => string; linkComponent: ComponentType<LinkProps> }
  | { onCategoryChange: (id: string | undefined) => void }
);

export function CategorySidebar(props: CategorySidebarProps) {
  const { categories, categoryId, title, navigationLabel, clearLabel, preferenceKey } = props;
  const [open, setOpen] = usePanelPreference(preferenceKey);

  function categoryControl(id: string | null, className: string, children: ReactNode) {
    const active = id !== null && id === categoryId;
    const ariaLabel = id === null ? clearLabel : undefined;
    if ("categoryHref" in props) {
      const Link = props.linkComponent;
      return (
        <Link
          href={props.categoryHref(id)}
          aria-label={ariaLabel}
          aria-current={active ? "page" : undefined}
          className={className}
        >
          {children}
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={id === null ? undefined : active}
        onClick={() => {
          if (!active) props.onCategoryChange(id ?? undefined);
        }}
        className={cn("cursor-pointer text-left", className)}
      >
        {children}
      </button>
    );
  }

  const clear = categoryId && (
    <IconTooltip label={clearLabel}>
      {categoryControl(
        null,
        "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-8",
        <XIcon aria-hidden="true" className="size-4 shrink-0" />,
      )}
    </IconTooltip>
  );
  const navigation = (
    <nav aria-label={navigationLabel}>
      <ul className="space-y-3">
        {categories.map(({ id, parentId, label }) => (
          <li key={id}>
            {categoryControl(
              id,
              cn(
                "block text-sm wrap-anywhere hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                parentId && "ml-2 border-l py-1 pl-4",
                categoryId === id
                  ? "border-primary font-semibold text-primary"
                  : parentId
                    ? "border-border text-muted-foreground"
                    : "font-semibold text-foreground",
              ),
              label,
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <aside className="relative rounded-3xl border border-border lg:order-last lg:p-5">
      <details className="group lg:hidden" open={open}>
        <summary
          onClick={(event) => {
            event.preventDefault();
            setOpen(!open);
          }}
          className={cn(
            "flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 rounded-3xl p-4 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
            categoryId && "pr-14",
          )}
        >
          <h2 className="font-serif text-base font-semibold">{title}</h2>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">{navigation}</div>
      </details>
      {clear && <div className="absolute top-2 right-2 lg:hidden">{clear}</div>}
      <div className="hidden lg:block">
        <div className="mb-5 flex min-h-8 items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          {clear}
        </div>
        {navigation}
      </div>
    </aside>
  );
}
