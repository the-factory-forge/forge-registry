import { FlameIcon } from "lucide-react";

import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import type { MenuSpiceLevel } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export interface MenuSpiceBadgeProps {
  level: MenuSpiceLevel;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuSpiceBadge({ level, labels: overrides, className }: MenuSpiceBadgeProps) {
  if (level === 0) return null;
  const labels = { ...menusLabels, ...overrides };
  const text = level === 1 ? labels.mildSpice : level === 2 ? labels.mediumSpice : labels.hotSpice;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-status-pending px-2.5 py-1 text-xs font-medium text-status-pending-foreground",
        className,
      )}
    >
      <span className="inline-flex shrink-0 gap-0.5" aria-hidden="true">
        {Array.from({ length: level }, (_, index) => (
          <FlameIcon key={index} className="size-4" aria-hidden="true" />
        ))}
      </span>
      <span className="min-w-0 wrap-anywhere">{text}</span>
    </span>
  );
}
