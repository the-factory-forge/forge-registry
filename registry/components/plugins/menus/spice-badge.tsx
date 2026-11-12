import { FlameIcon } from "lucide-react";

import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import type { MenuSpiceLevel } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export interface MenuSpiceBadgeProps {
  level: MenuSpiceLevel;
  labels?: Partial<MenusLabels>;
  className?: string;
  iconOnly?: boolean;
}

export function MenuSpiceBadge({
  level,
  labels: overrides,
  className,
  iconOnly = false,
}: MenuSpiceBadgeProps) {
  if (level === 0) return null;
  const labels = { ...menusLabels, ...overrides };
  const text = level === 1 ? labels.mildSpice : level === 2 ? labels.mediumSpice : labels.hotSpice;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-status-pending px-2.5 py-1 text-xs font-medium text-status-pending-foreground",
        iconOnly && "print:[print-color-adjust:exact]",
        className,
      )}
    >
      <span className="inline-flex shrink-0 gap-0.5" aria-hidden="true">
        {Array.from({ length: level }, (_, index) => (
          <FlameIcon key={index} className="size-4" aria-hidden="true" />
        ))}
      </span>
      <span className={iconOnly ? "sr-only" : "min-w-0 wrap-anywhere"}>{text}</span>
    </span>
  );
}
