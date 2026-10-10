"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PanelLeftIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { SidebarNavigation, type SidebarNavigationProps } from "@/components/sidebar-navigation";
import { cn } from "@/components/utils/cn";
import { useSidebarMobile } from "@/components/utils/use-sidebar-mobile";

export type {
  SidebarNavGroup,
  SidebarNavItem,
  SidebarLinkProps,
} from "@/components/sidebar-navigation";

export interface SubpageSidebarProps extends Omit<SidebarNavigationProps, "onNavigate"> {
  closeLabel?: string;
}

export function SubpageSidebar({
  label = "Page navigation",
  closeLabel = "Close page navigation",
  className,
  ...navigation
}: SubpageSidebarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useSidebarMobile();
  return (
    <div className={cn("shrink-0 md:w-48 lg:w-56 print:hidden", className)}>
      {!isMobile ? (
        <div className="h-full border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarNavigation {...navigation} label={label} />
        </div>
      ) : (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:hidden">
            <PanelLeftIcon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
            <Dialog.Popup
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground outline-none"
            >
              <header className="flex min-h-14 items-center justify-between gap-2 px-4">
                <Dialog.Title className="min-w-0 font-semibold wrap-anywhere">{label}</Dialog.Title>
                <IconTooltip label={closeLabel}>
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </Dialog.Close>
                </IconTooltip>
              </header>
              <SidebarNavigation {...navigation} label={label} onNavigate={() => setOpen(false)} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
