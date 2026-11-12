import type { MenuLabelIcon } from "@/components/plugins/menus/label-presets";

export interface MenuTranslation {
  name: string;
  description: string;
}

export interface MenuCategory {
  id: string;
  version?: number;
  position: number;
  translations: Record<string, string>;
  descriptions?: Record<string, string>;
}

export interface MenuLabel {
  id: string;
  kind: "allergen" | "dietary";
  /** Omit on updates to preserve the saved icon; null restores the automatic icon. */
  icon?: MenuLabelIcon | null;
  position: number;
  translations: Record<string, string>;
}

export type MenuSpiceLevel = 0 | 1 | 2 | 3;

export interface MenuItemSize {
  id: string;
  priceMinor: number;
  translations: Record<string, string>;
}

export interface MenuItem {
  id: string;
  version: number;
  categoryId: string | null;
  priceMinor: number | null;
  sizes?: MenuItemSize[];
  position: number;
  visible: boolean;
  soldOut: boolean;
  spiceLevel?: MenuSpiceLevel;
  imageEntryId: string | null;
  labelIds: string[];
  translations: Record<string, MenuTranslation>;
}

export type MenuItemInput = Omit<MenuItem, "id" | "version">;
export type MenuCategoryInput = Omit<MenuCategory, "id" | "version">;
export type MenuLabelInput = Omit<MenuLabel, "id">;

export interface MenuViewLabel {
  id: string;
  kind: MenuLabel["kind"];
  icon?: MenuLabelIcon | null;
  name: string;
}

export interface MenuViewItem extends Omit<MenuItem, "translations" | "labelIds" | "sizes"> {
  name: string;
  description: string;
  labels: MenuViewLabel[];
  sizes?: { id: string; name: string; priceMinor: number }[];
}
export interface MenuViewCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuViewItem[];
}

export interface MenuItemGroupOrder {
  categoryId: string;
  items: Pick<MenuItem, "id" | "version">[];
}

/** The host implements transport. Staff identity is supplied only by its server session. */
export interface MenusClient {
  list(): Promise<MenuItem[]>;
  /** Hosts may use a scoped query; clients without it fall back to list(). */
  listUnassigned?(): Promise<MenuItem[]>;
  get(id: string): Promise<MenuItem>;
  create(input: MenuItemInput, options?: { visibleOnCreate?: boolean }): Promise<MenuItem>;
  save(id: string, version: number, input: MenuItemInput): Promise<MenuItem>;
  /** Save the complete item order atomically, checking every supplied version. */
  reorder?(order: Pick<MenuItem, "id" | "version">[]): Promise<MenuItem[]>;
  remove(
    id: string,
    scope?: { categoryId: null; version: number } | { menuId: string; version: number },
  ): Promise<void>;
  categories(): Promise<MenuCategory[]>;
  saveCategory(
    input: MenuCategoryInput & {
      id?: string;
      version?: number;
      menu?: Pick<MenuCard, "id" | "version">;
    },
  ): Promise<MenuCategory>;
  /** Omitting options keeps the legacy empty-only deletion. Supply the complete dish snapshot to keep or delete its dishes. */
  removeCategory(
    id: string,
    menu?: Pick<MenuCard, "id" | "version">,
    options?: { deleteItems?: boolean; items?: Pick<MenuItem, "id" | "version">[] },
  ): Promise<void>;
  labels(): Promise<MenuLabel[]>;
  saveLabel(input: MenuLabelInput & { id?: string }): Promise<MenuLabel>;
  removeLabel(id: string): Promise<void>;
}

export const menuKinds = ["standard", "formula", "weekly"] as const;
export type MenuKind = (typeof menuKinds)[number];
export const weeklyCourses = ["starter", "main", "dessert"] as const;
export interface WeeklySection {
  categoryId: string;
  day: number;
  course: (typeof weeklyCourses)[number];
}

export interface MenuCard {
  id: string;
  version: number;
  position: number;
  translations: Record<string, MenuTranslation>;
  categoryIds: string[];
  published: boolean;
  displayMode: "lines" | "photos";
  startDate: string | null;
  endDate: string | null;
  kind?: MenuKind;
  weekdays?: number[];
  weeklySections?: WeeklySection[];
  currencyLabel?: string;
}

export type MenuCardInput = Omit<MenuCard, "id" | "version"> & {
  id?: string;
  version?: number;
};

export interface MenuCardView {
  card: Pick<
    MenuCard,
    | "id"
    | "displayMode"
    | "startDate"
    | "endDate"
    | "kind"
    | "weekdays"
    | "weeklySections"
    | "currencyLabel"
  > &
    MenuTranslation;
  categories: MenuViewCategory[];
}

/** The host supplies the transport and authenticates staff before calling the service. */
export interface MenuCardsClient {
  listCards(): Promise<MenuCard[]>;
  saveCard(input: MenuCardInput): Promise<MenuCard>;
  removeCard(id: string, version: number): Promise<void>;
  listItems(id: string): Promise<MenuItem[]>;
  placeItems(groups: MenuItemGroupOrder[]): Promise<MenuItem[]>;
  nextWeek(id: string, version: number, requestId: string): Promise<MenuCard>;
}
