"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import {
  ChevronsUpDownIcon,
  Loader2Icon,
  LogOutIcon,
  PanelLeftIcon,
  SettingsIcon,
} from "lucide-react";
import * as React from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { useAuthAction } from "@/components/plugins/auth/auth-controls";
import {
  SidebarNavigation,
  type SidebarLinkProps,
  type SidebarNavItem,
  type SidebarNavGroup,
} from "@/components/sidebar-navigation";
import { cn } from "@/components/utils/cn";
import { useSidebarMobile } from "@/components/utils/use-sidebar-mobile";

export type IntranetLinkProps = SidebarLinkProps;
export type IntranetNavItem = SidebarNavItem;
export type IntranetNavGroup = SidebarNavGroup;

export interface IntranetSidebarProps {
  /** Use a compact symbol-only logo; the site name is rendered separately. */
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
  expand: "Expand",
  collapse: "Collapse",
  profile: "Profile settings",
  userMenu: "User menu",
  signOut: "Sign out",
  signingOut: "Signing out…",
  signOutError: "Could not sign out. Please try again.",
};

const focusClassName = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const sidebarFocusClassName = "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

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
  const isMobile = useSidebarMobile();
  const open = controlledOpen ?? localOpen;
  const id = `factory-intranet-sidebar-${React.useId()}`;
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
        className={cn(
          "flex min-h-[calc(100svh-var(--intranet-top-offset,0rem))] w-full",
          className,
        )}
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
    <IconTooltip label={label}>
      <button
        type="button"
        data-sidebar="trigger"
        aria-label={label}
        aria-controls={id}
        aria-expanded={isMobile ? mobileOpen : open}
        className={cn(
          "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-accent disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed print:hidden",
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
    </IconTooltip>
  );
}

export type IntranetSidebarInsetProps = React.ComponentProps<"main"> & {
  /** Use a div when the host page already supplies its main landmark. */
  as?: "main" | "div";
};
export function IntranetSidebarInset({
  as: Component = "main",
  className,
  ...props
}: IntranetSidebarInsetProps) {
  return React.createElement(Component, {
    "data-slot": "sidebar-inset",
    className: cn("relative flex min-w-0 flex-1 flex-col bg-background", className),
    ...props,
  });
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
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs leading-none font-medium text-foreground">
      {user.image && user.image !== failedImage ? (
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
  const signOutAction = useAuthAction();
  const { pending: signingOut, failed: signOutFailed } = signOutAction;
  const closeMobile = () => setMobileOpen(false);

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
          className={cn("flex min-w-0 items-center gap-2 rounded-sm", sidebarFocusClassName)}
          onClick={closeMobile}
        >
          {brand.logo && (
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center [&>img]:size-full [&>img]:object-contain [&>svg]:size-full"
            >
              {brand.logo}
            </span>
          )}
          <span className="truncate text-base font-semibold" title={brand.name}>
            {brand.name}
          </span>
        </LinkComponent>
      </header>
      <div className="mx-2 border-t border-sidebar-border" />
      <SidebarNavigation
        groups={groups}
        pathname={pathname}
        linkComponent={LinkComponent}
        onNavigate={closeMobile}
        label={labels.navigation}
        labels={labels}
      />
      {version && <p className="px-2 py-1 text-center text-xs text-muted-foreground">{version}</p>}
      <div className="mx-2 border-t border-sidebar-border" />
      <footer className="shrink-0 p-2">
        {signOutFailed && (
          <p role="alert" className="px-2 pb-2 text-sm text-destructive">
            {labels.signOutError}
          </p>
        )}
        <Menu.Root key={open ? "expanded" : "collapsed"}>
          <Menu.Trigger
            aria-label={labels.userMenu}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
              sidebarFocusClassName,
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
                className="min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
              >
                <Menu.Item
                  render={<LinkComponent href={profileHref} />}
                  onClick={closeMobile}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-disabled:cursor-not-allowed data-highlighted:bg-accent",
                    focusClassName,
                  )}
                >
                  <SettingsIcon className="size-4" aria-hidden="true" />
                  {labels.profile}
                </Menu.Item>
                <Menu.Separator className="my-1 border-t border-border" />
                <Menu.Item
                  disabled={signOutAction.disabled}
                  onClick={() => void signOutAction.run(onSignOut)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-accent",
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
            "fixed top-[calc(var(--intranet-top-offset,0rem)+0.5rem)] left-2 z-30 border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
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
                "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground outline-none print:hidden",
                className,
              )}
            >
              <Dialog.Title className="sr-only">{labels.navigation}</Dialog.Title>
              <IconTooltip label={labels.close}>
                <Dialog.Close
                  aria-label={labels.close}
                  className={cn(
                    "absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
                    sidebarFocusClassName,
                  )}
                >
                  <PanelLeftIcon className="size-4" aria-hidden="true" />
                </Dialog.Close>
              </IconTooltip>
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
              "fixed top-[var(--intranet-top-offset,0rem)] bottom-0 left-0 z-20 flex h-[calc(100svh-var(--intranet-top-offset,0rem))] w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none",
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
