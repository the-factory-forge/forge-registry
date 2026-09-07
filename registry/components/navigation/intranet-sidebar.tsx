"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  LogOutIcon,
  PanelLeftIcon,
  SettingsIcon,
} from "lucide-react";
import * as React from "react";

import { Link } from "@/components/forge/ui/link";
import { cn } from "@/lib/forge/utils";

export type IntranetLinkProps = React.ComponentProps<"a"> & { href: string };

type NavItemBase = { id: string; label: string; icon?: React.ReactNode };
export type IntranetNavItem = NavItemBase &
  (
    | { href: string; exact?: boolean; items?: never; collapsible?: never }
    | { items: IntranetNavItem[]; collapsible?: boolean; href?: never; exact?: never }
  );

export interface IntranetNavGroup {
  id: string;
  label?: string;
  items: IntranetNavItem[];
  /** Site-owned actions, such as opening an impersonation dialog. */
  footer?: React.ReactNode;
}

export interface IntranetSidebarProps {
  brand: { name: string; href: string; logo?: React.ReactNode };
  /** Compatible with Better Auth's standard session user fields. */
  user: { name: string; email: string; image?: string | null };
  groups: IntranetNavGroup[];
  pathname: string;
  profileHref: string;
  /** Call Better Auth, throw on result.error, then invalidate the host session. */
  onSignOut: () => Promise<void>;
  linkComponent?: React.ComponentType<IntranetLinkProps>;
  version?: string;
  /** External requires an IntranetSidebarToggle inside the same provider. */
  togglePlacement?: "sidebar" | "external";
  labels?: Partial<typeof defaultLabels>;
  className?: string;
}

const defaultLabels = {
  navigation: "Side navigation",
  toggle: "Toggle side navigation",
  close: "Close side navigation",
  profile: "Profile settings",
  userMenu: "User menu",
  signOut: "Sign out",
  signingOut: "Signing out…",
  signOutError: "Could not sign out. Please try again.",
};

const focusClassName = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const navClassName = `relative flex w-full items-center gap-2 rounded-lg border-l-2 border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${focusClassName}`;
const activeClassName = "border-primary bg-accent/40 font-semibold text-primary";

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type SidebarContextValue = {
  id: string;
  isMobile: boolean;
  open: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggle: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};
const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useIntranetSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context)
    throw new Error("Use an IntranetSidebarProvider around the sidebar and its toggle.");
  return context;
}

export type IntranetSidebarProviderProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function IntranetSidebarProvider({
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  onFocusCapture,
  ...props
}: IntranetSidebarProviderProps) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isMobile = React.useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const open = controlledOpen ?? localOpen;
  const id = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const sidebarHadFocus = React.useRef(false);
  const toggle = React.useCallback(() => {
    if (isMobile) setMobileOpen((value) => !value);
    else {
      if (controlledOpen === undefined) setLocalOpen(!open);
      onOpenChange?.(!open);
    }
  }, [isMobile, controlledOpen, open, onOpenChange]);

  React.useEffect(() => {
    if (!isMobile && !open && sidebarHadFocus.current) {
      document
        .querySelector<HTMLButtonElement>(`button[aria-controls="${CSS.escape(id)}"]`)
        ?.focus();
    }
  }, [isMobile, open, id]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <SidebarContext.Provider
      value={{ id, isMobile, open, mobileOpen, setMobileOpen, toggle, triggerRef }}
    >
      <div
        data-slot="sidebar-wrapper"
        className={cn("flex min-h-svh w-full", className)}
        onFocusCapture={(event) => {
          sidebarHadFocus.current = Boolean(
            event.target.closest('[data-slot="sidebar"], [data-sidebar-profile-menu]'),
          );
          onFocusCapture?.(event);
        }}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export type IntranetSidebarToggleProps = React.ComponentProps<"button">;

export function IntranetSidebarToggle({
  className,
  onClick,
  children,
  "aria-label": label = defaultLabels.toggle,
  ...props
}: IntranetSidebarToggleProps) {
  const { id, isMobile, open, mobileOpen, toggle, triggerRef } = useIntranetSidebar();
  return (
    <button
      type="button"
      data-sidebar="trigger"
      aria-label={label}
      aria-controls={id}
      aria-expanded={isMobile ? mobileOpen : open}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-accent print:hidden",
        focusClassName,
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          triggerRef.current = event.currentTarget;
          toggle();
        }
      }}
      {...props}
    >
      {children ?? <PanelLeftIcon className="size-4" aria-hidden="true" />}
    </button>
  );
}

export type IntranetSidebarInsetProps = React.ComponentProps<"main">;
export function IntranetSidebarInset({ className, ...props }: IntranetSidebarInsetProps) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("relative flex min-w-0 flex-1 flex-col bg-background", className)}
      {...props}
    />
  );
}

function itemIsActive(item: IntranetNavItem, pathname: string): boolean {
  if (item.items) return item.items.some((child) => itemIsActive(child, pathname));
  const path = item.href.replace(/\/$/, "") || "/";
  const current = pathname.replace(/\/$/, "") || "/";
  return current === path || (!item.exact && path !== "/" && current.startsWith(`${path}/`));
}

function NavigationItem({
  item,
  pathname,
  LinkComponent,
  closeMobile,
}: {
  item: IntranetNavItem;
  pathname: string;
  LinkComponent: React.ComponentType<IntranetLinkProps>;
  closeMobile: () => void;
}) {
  const active = itemIsActive(item, pathname);
  const [expansion, setExpansion] = React.useState({ pathname, open: active });
  if (expansion.pathname !== pathname) setExpansion({ pathname, open: expansion.open || active });
  const expanded = expansion.open;
  const childList = item.items && (
    <ul className="ml-4 space-y-0.5 border-l border-border px-2 py-1">
      {item.items.map((child) => (
        <NavigationItem
          key={child.id}
          item={child}
          pathname={pathname}
          LinkComponent={LinkComponent}
          closeMobile={closeMobile}
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
      <span className="min-w-0 flex-1 text-left">{item.label}</span>
    </>
  );

  if (item.items) {
    if (item.items.length === 0) return null;
    if (item.collapsible === false)
      return (
        <li>
          <p className="px-2 pt-2 text-xs font-medium text-muted-foreground uppercase">
            {item.label}
          </p>
          {childList}
        </li>
      );
    return (
      <li>
        <Collapsible.Root open={expanded} onOpenChange={(open) => setExpansion({ pathname, open })}>
          <Collapsible.Trigger className={cn(navClassName, active && activeClassName)}>
            {label}
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 transition-transform motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Collapsible.Trigger>
          <Collapsible.Panel>{childList}</Collapsible.Panel>
        </Collapsible.Root>
      </li>
    );
  }
  return (
    <li>
      <LinkComponent
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(navClassName, active && activeClassName)}
        onClick={(event) => {
          if (
            !event.defaultPrevented &&
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          )
            closeMobile();
        }}
      >
        {label}
      </LinkComponent>
    </li>
  );
}

function UserAvatar({ user }: Pick<IntranetSidebarProps, "user">) {
  const [failedImage, setFailedImage] = React.useState<string>();
  const initials = (user.name.trim() || user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-foreground">
      {user.image && user.image !== failedImage ? (
        // oxlint-disable-next-line nextjs/no-img-element -- an unoptimized, consumer-owned profile image
        <img
          src={user.image}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedImage(user.image ?? undefined)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

export function IntranetSidebar({
  brand,
  user,
  groups,
  pathname,
  profileHref,
  onSignOut,
  linkComponent: LinkComponent = Link,
  version,
  togglePlacement = "sidebar",
  labels: overrides,
  className,
}: IntranetSidebarProps) {
  const { id, open, isMobile, mobileOpen, setMobileOpen, triggerRef } = useIntranetSidebar();
  const labels = { ...defaultLabels, ...overrides };
  const [signingOut, setSigningOut] = React.useState(false);
  const [signOutFailed, setSignOutFailed] = React.useState(false);
  const signOutInFlight = React.useRef(false);
  const closeMobile = () => setMobileOpen(false);

  async function signOut() {
    if (signOutInFlight.current) return;
    signOutInFlight.current = true;
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await onSignOut();
    } catch {
      setSignOutFailed(true);
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }

  const content = (
    <>
      <header
        className={cn(
          "flex h-12 shrink-0 items-center px-4",
          (togglePlacement === "sidebar" || isMobile) && "pr-12",
        )}
      >
        <LinkComponent
          href={brand.href}
          className={cn("flex min-w-0 items-center gap-2 rounded-sm", focusClassName)}
          onClick={closeMobile}
        >
          {brand.logo && (
            <span className="shrink-0 [&>img]:size-7 [&>svg]:size-7">{brand.logo}</span>
          )}
          <span className="truncate text-base font-semibold" title={brand.name}>
            {brand.name}
          </span>
        </LinkComponent>
      </header>
      <div className="mx-2 border-t border-border" />
      <nav aria-label={labels.navigation} className="min-h-0 flex-1 overflow-y-auto py-2">
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
                    closeMobile={closeMobile}
                  />
                ))}
              </ul>
              {group.footer}
            </section>
          ))}
      </nav>
      {version && <p className="px-2 py-1 text-center text-xs text-muted-foreground">{version}</p>}
      <div className="mx-2 border-t border-border" />
      <footer className="shrink-0 p-2">
        {signOutFailed && (
          <p role="alert" className="px-2 pb-2 text-sm text-red-600 dark:text-red-400">
            {labels.signOutError}
          </p>
        )}
        <Menu.Root key={open ? "expanded" : "collapsed"}>
          <Menu.Trigger
            aria-label={labels.userMenu}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent",
              focusClassName,
            )}
          >
            <UserAvatar user={user} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{user.name || user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            {signingOut ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            )}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="top" align="start" sideOffset={8} className="z-50">
              <Menu.Popup
                data-sidebar-profile-menu=""
                className="min-w-56 rounded-lg border border-border bg-background p-1 text-foreground shadow-lg outline-none"
              >
                <Menu.Item
                  render={<LinkComponent href={profileHref} />}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm data-highlighted:bg-accent",
                    focusClassName,
                  )}
                >
                  <SettingsIcon className="size-4" aria-hidden="true" />
                  {labels.profile}
                </Menu.Item>
                <Menu.Separator className="my-1 border-t border-border" />
                <Menu.Item
                  disabled={signingOut}
                  onClick={() => void signOut()}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm data-disabled:opacity-50 data-highlighted:bg-accent",
                    focusClassName,
                  )}
                >
                  <LogOutIcon className="size-4" aria-hidden="true" />
                  {signingOut ? labels.signingOut : labels.signOut}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <output className="sr-only">{signingOut ? labels.signingOut : ""}</output>
      </footer>
    </>
  );

  return (
    <>
      {togglePlacement === "sidebar" && (
        <IntranetSidebarToggle
          aria-label={labels.toggle}
          className={cn(
            "fixed top-2 left-2 z-30 border border-border bg-background text-foreground shadow-sm",
            !isMobile && open && "left-[13.5rem]",
          )}
        />
      )}
      {isMobile ? (
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40 print:hidden" />
            <Dialog.Popup
              id={id}
              finalFocus={() =>
                triggerRef.current ??
                document.querySelector<HTMLButtonElement>(
                  `button[aria-controls="${CSS.escape(id)}"]`,
                )
              }
              aria-describedby={undefined}
              data-slot="sidebar"
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-border bg-background text-foreground outline-none print:hidden",
                className,
              )}
            >
              <Dialog.Title className="sr-only">{labels.navigation}</Dialog.Title>
              <Dialog.Close
                aria-label={labels.close}
                className={cn(
                  "absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg hover:bg-accent",
                  focusClassName,
                )}
              >
                <PanelLeftIcon className="size-4" aria-hidden="true" />
              </Dialog.Close>
              {content}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        <div
          className={cn(
            "hidden shrink-0 transition-[width] duration-200 motion-reduce:transition-none md:block print:hidden",
            open ? "w-64" : "w-0",
          )}
        >
          <aside
            id={id}
            aria-label={labels.navigation}
            inert={!open}
            data-slot="sidebar"
            data-state={open ? "expanded" : "collapsed"}
            className={cn(
              "fixed inset-y-0 left-0 z-20 flex h-svh w-64 flex-col border-r border-border bg-background text-foreground transition-transform duration-200 motion-reduce:transition-none",
              !open && "invisible -translate-x-full",
              className,
            )}
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
