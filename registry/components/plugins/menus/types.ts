import type { MenuLabelIcon } from "@/components/plugins/menus/label-presets";

export interface MenuTranslation {
  name: string;
  description: string;
}

export interface MenuCategory {
  id: string;
  position: number;
  translations: Record<string, string>;
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
  categoryId: string;
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
export type MenuCategoryInput = Omit<MenuCategory, "id">;
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
  items: MenuViewItem[];
}

/** The host implements transport. Staff identity is supplied only by its server session. */
export interface MenusClient {
  list(): Promise<MenuItem[]>;
  get(id: string): Promise<MenuItem>;
  create(input: MenuItemInput): Promise<MenuItem>;
  save(id: string, version: number, input: MenuItemInput): Promise<MenuItem>;
  /** Save the complete item order atomically, checking every supplied version. */
  reorder?(order: Pick<MenuItem, "id" | "version">[]): Promise<MenuItem[]>;
  remove(id: string): Promise<void>;
  categories(): Promise<MenuCategory[]>;
  saveCategory(input: MenuCategoryInput & { id?: string }): Promise<MenuCategory>;
  removeCategory(id: string): Promise<void>;
  labels(): Promise<MenuLabel[]>;
  saveLabel(input: MenuLabelInput & { id?: string }): Promise<MenuLabel>;
  removeLabel(id: string): Promise<void>;
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
}

export type MenuCardInput = Omit<MenuCard, "id" | "version"> & {
  id?: string;
  version?: number;
};

export interface MenuCardView {
  card: Pick<MenuCard, "id" | "displayMode" | "startDate" | "endDate"> & MenuTranslation;
  categories: MenuViewCategory[];
}

/** The host supplies the transport and authenticates staff before calling the service. */
export interface MenuCardsClient {
  listCards(): Promise<MenuCard[]>;
  saveCard(input: MenuCardInput): Promise<MenuCard>;
  removeCard(id: string, version: number): Promise<void>;
}
