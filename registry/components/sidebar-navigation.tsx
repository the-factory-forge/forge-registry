"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { cn } from "@/components/utils/cn";
import { itemIsActive } from "@/components/utils/intranet-sidebar-active";

export type SidebarLinkProps = React.ComponentProps<"a"> & { href: string };
type NavItemBase = { id: string; label: string; icon?: React.ReactNode; onNavigate?: () => void };
export type SidebarNavItem = NavItemBase &
  (
    | {
        href: string;
        exact?: boolean;
        items?: never;
        collapsible?: never;
        onSelect?: never;
        active?: never;
      }
    | {
        items: SidebarNavItem[];
        collapsible?: boolean;
        href?: string;
        exact?: boolean;
        onSelect?: never;
        active?: never;
      }
    | {
        onSelect: () => void;
        active: boolean;
        href?: never;
        exact?: never;
        items?: never;
        collapsible?: never;
      }
  );

export interface SidebarNavGroup {
  id: string;
  label?: string;
  items: SidebarNavItem[];
  footer?: React.ReactNode | ((onNavigate: () => void) => React.ReactNode);
}

export interface SidebarNavigationProps {
  groups: SidebarNavGroup[];
  pathname?: string;
  linkComponent?: React.ComponentType<SidebarLinkProps>;
  onNavigate?: () => void;
  label?: string;
  labels?: { expand?: string; collapse?: string };
  className?: string;
}

const sidebarFocusClassName = "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
export const sidebarNavItemClass = `relative flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg border-l-2 border-transparent px-2 py-1.5 text-sm text-sidebar-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${sidebarFocusClassName}`;
export const sidebarNavActiveClass =
  "rounded-l-none border-sidebar-primary bg-sidebar-accent/40 font-semibold text-sidebar-primary";

function NavigationItem({
  item,
  pathname,
  LinkComponent,
  closeMobile,
  labels,
  nested = false,
}: {
  item: SidebarNavItem;
  pathname: string;
  LinkComponent: React.ComponentType<SidebarLinkProps>;
  closeMobile: () => void;
  labels: { expand: string; collapse: string };
  nested?: boolean;
}) {
  const active = itemIsActive(item, pathname);
  const [expansion, setExpansion] = React.useState({ pathname, open: active });
  if (expansion.pathname !== pathname) setExpansion({ pathname, open: expansion.open || active });
  const expanded = expansion.open;
  const itemClasses = cn(
    nested && "-ml-[9px] w-[calc(100%+9px)] rounded-l-none bg-clip-padding pl-[17px]",
    active && sidebarNavActiveClass,
  );
  const childList = Boolean(item.items?.length) && (
    <ul className="ml-4 space-y-0.5 border-l border-sidebar-border px-2 py-1">
      {item.items?.map((child) => (
        <NavigationItem
          key={child.id}
          item={child}
          nested
          pathname={pathname}
          LinkComponent={LinkComponent}
          closeMobile={closeMobile}
          labels={labels}
        />
      ))}
    </ul>
  );
  const label = (
    <>
      {item.icon && (
        <span className="shrink-0 [&>svg]:size-4" aria-hidden="true">
          {item.icon}
        </span>
      )}
      <span className="min-w-0 flex-1 text-left wrap-anywhere">{item.label}</span>
    </>
  );
  const link = item.onSelect ? (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(sidebarNavItemClass, itemClasses)}
      onClick={() => {
        item.onSelect?.();
        closeMobile();
      }}
    >
      {label}
    </button>
  ) : (
    item.href && (
      <LinkComponent
        href={item.href}
        aria-current={
          (item.items ? itemIsActive({ href: item.href, exact: true }, pathname) : active)
            ? "page"
            : undefined
        }
        className={cn(sidebarNavItemClass, "min-w-0 flex-1", itemClasses)}
        onClick={(event) => {
          if (
            !event.defaultPrevented &&
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            item.onNavigate?.();
            closeMobile();
          }
        }}
      >
        {label}
      </LinkComponent>
    )
  );

  if (!childList) return link ? <li>{link}</li> : null;
  if (item.collapsible === false)
    return (
      <li>
        {link || (
          <p className="px-2 pt-2 text-xs font-medium text-muted-foreground uppercase">
            {item.label}
          </p>
        )}
        {childList}
      </li>
    );

  const chevron = (
    <ChevronDownIcon
      className={cn(
        "size-4 shrink-0 transition-transform motion-reduce:transition-none",
        expanded && "rotate-180",
      )}
      aria-hidden="true"
    />
  );
  return (
    <li>
      <Collapsible.Root open={expanded} onOpenChange={(open) => setExpansion({ pathname, open })}>
        {link ? (
          <div className="flex items-center gap-1">
            {link}
            <IconTooltip label={`${expanded ? labels.collapse : labels.expand} ${item.label}`}>
              <Collapsible.Trigger
                aria-label={`${expanded ? labels.collapse : labels.expand} ${item.label}`}
                className={cn(
                  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
                  sidebarFocusClassName,
                )}
              >
                {chevron}
              </Collapsible.Trigger>
            </IconTooltip>
          </div>
        ) : (
          <Collapsible.Trigger className={cn(sidebarNavItemClass, itemClasses)}>
            {label}
            {chevron}
          </Collapsible.Trigger>
        )}
        <Collapsible.Panel>{childList}</Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}

export function SidebarNavigation({
  groups,
  pathname = "",
  linkComponent: LinkComponent = Link,
  onNavigate,
  label = "Side navigation",
  labels: overrides,
  className,
}: SidebarNavigationProps) {
  const labels = { expand: "Expand", collapse: "Collapse", ...overrides };
  return (
    <nav aria-label={label} className={cn("min-h-0 flex-1 overflow-y-auto py-2", className)}>
      {groups
        .filter((group) => group.items.length > 0 || group.footer)
        .map((group) => (
          <section key={group.id} aria-label={group.label} className="px-2 py-2">
            {group.label && (
              <h2 className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  LinkComponent={LinkComponent}
                  closeMobile={() => onNavigate?.()}
                  labels={labels}
                />
              ))}
            </ul>
            {typeof group.footer === "function" ? group.footer(() => onNavigate?.()) : group.footer}
          </section>
        ))}
    </nav>
  );
}
