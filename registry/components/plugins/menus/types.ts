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
  position: number;
  translations: Record<string, string>;
}

export interface MenuItem {
  id: string;
  version: number;
  categoryId: string;
  priceMinor: number;
  position: number;
  visible: boolean;
  soldOut: boolean;
  imageEntryId: string | null;
  labelIds: string[];
  translations: Record<string, MenuTranslation>;
}

export type MenuItemInput = Omit<MenuItem, "id" | "version">;
export type MenuCategoryInput = Omit<MenuCategory, "id">;
export type MenuLabelInput = Omit<MenuLabel, "id">;

export interface MenuViewItem extends Omit<MenuItem, "translations" | "labelIds"> {
  name: string;
  description: string;
  labels: { id: string; kind: MenuLabel["kind"]; name: string }[];
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
  remove(id: string): Promise<void>;
  categories(): Promise<MenuCategory[]>;
  saveCategory(input: MenuCategoryInput & { id?: string }): Promise<MenuCategory>;
  removeCategory(id: string): Promise<void>;
  labels(): Promise<MenuLabel[]>;
  saveLabel(input: MenuLabelInput & { id?: string }): Promise<MenuLabel>;
  removeLabel(id: string): Promise<void>;
}
