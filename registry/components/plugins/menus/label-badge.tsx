import {
  BadgeCheckIcon,
  BeanIcon,
  CarrotIcon,
  CircleDotIcon,
  EggIcon,
  FishIcon,
  Flower2Icon,
  LeafIcon,
  MilkIcon,
  NutIcon,
  ShellIcon,
  ShrimpIcon,
  SproutIcon,
  TriangleAlertIcon,
  VeganIcon,
  WheatIcon,
  WineIcon,
} from "lucide-react";

import {
  getMenuLabelPreset,
  type MenuLabelIcon,
  type MenuLabelTone,
} from "@/components/plugins/menus/label-presets";
import type { MenuViewLabel } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

const icons: Record<MenuLabelIcon, typeof LeafIcon> = {
  leaf: LeafIcon,
  vegan: VeganIcon,
  fish: FishIcon,
  wheat: WheatIcon,
  milk: MilkIcon,
  egg: EggIcon,
  nut: NutIcon,
  bean: BeanIcon,
  sprout: SproutIcon,
  shrimp: ShrimpIcon,
  shell: ShellIcon,
  carrot: CarrotIcon,
  flower: Flower2Icon,
  seeds: CircleDotIcon,
  wine: WineIcon,
  check: BadgeCheckIcon,
};
const tones: Record<MenuLabelTone, string> = {
  success: "bg-status-success text-status-success-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
  info: "bg-status-info text-status-info-foreground",
};

export function menuLabelColorClasses(label: MenuViewLabel) {
  return tones[getMenuLabelPreset(label)?.tone ?? (label.kind === "dietary" ? "success" : "info")];
}

export interface MenuLabelBadgeProps {
  label: MenuViewLabel;
  className?: string;
}

export interface MenuLabelSymbolProps {
  label: MenuViewLabel;
  className?: string;
}

export function MenuLabelSymbol({ label, className }: MenuLabelSymbolProps) {
  const icon = label.icon ?? getMenuLabelPreset(label)?.icon;
  const Icon = icon ? icons[icon] : label.kind === "dietary" ? LeafIcon : TriangleAlertIcon;
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

export function MenuLabelBadge({ label, className }: MenuLabelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        menuLabelColorClasses(label),
        className,
      )}
    >
      <MenuLabelSymbol label={label} />
      <span className="min-w-0 wrap-anywhere">{label.name}</span>
    </span>
  );
}
