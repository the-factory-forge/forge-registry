import type { MenuLabelIcon } from "@/components/plugins/menus/label-presets";

export interface MenusLabels {
  clearSearch: string;
  search: string;
  noMatches: string;
  menu: string;
  printMenu?: string;
  print?: string;
  preparingPrint?: string;
  printSettings?: string;
  paperSize?: string;
  menuTitle?: string;
  footerText?: string;
  printHelp?: string;
  printError?: string;
  printPreview?: string;
  emptyPrintMenu?: string;
  emptyMenu: string;
  soldOut: string;
  allergens: string;
  dietary: string;
  spiceLevel?: string;
  notSpicy?: string;
  mildSpice?: string;
  mediumSpice?: string;
  hotSpice?: string;
  excludeAllergens?: string;
  allergenFilterHelp?: string;
  dietaryFilterHelp?: string;
  clearFilters?: string;
  matchingItems?: string;
  noFilterMatches?: string;
  items: string;
  emptyItems: string;
  categories: string;
  labels: string;
  newItem: string;
  editItem: string;
  deleteItem: string;
  confirmDelete: string;
  deleteFilesFirst: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  loading: string;
  retry: string;
  name: string;
  description: string;
  category: string;
  price: string;
  sizes?: string;
  addSize?: string;
  sizeName?: string;
  removeSize?: string;
  sizeHelp?: string;
  baseSizeNameRequired?: string;
  position: string;
  reorder?: string;
  reorderHelp?: string;
  reorderSearchHelp?: string;
  visible: string;
  unavailable: string;
  photo: string;
  selectPhoto: string;
  removePhoto: string;
  language: string;
  baseNameRequired: string;
  back: string;
  newCategory: string;
  editCategory: string;
  newLabel: string;
  editLabel: string;
  labelKind: string;
  icon?: string;
  automaticIcon?: string;
  iconNames?: Partial<Record<MenuLabelIcon, string>>;
  deleteCategory: string;
  deleteLabel: string;
  yes: string;
  no: string;
}

export const menusLabels = {
  clearSearch: "Clear search",
  search: "Search menu items",
  noMatches: "No menu items match your search.",
  menu: "Menu",
  printMenu: "Print menu",
  print: "Print / Save PDF",
  preparingPrint: "Preparing print…",
  printSettings: "Print settings",
  paperSize: "Paper size",
  menuTitle: "Menu title",
  footerText: "Footer text (optional)",
  printHelp:
    "Print all visible dishes. Choose A4 portrait or A5 landscape, 100% scale, and turn off browser headers and footers in the print dialog. You can also save as PDF. These settings are not saved.",
  printError:
    "Could not prepare the menu for printing. Check that the logo and styles can load, then try again.",
  printPreview: "Menu print preview",
  emptyPrintMenu:
    "There are no visible dishes to print. Make an item visible in menu management first.",
  emptyMenu: "The menu is being prepared.",
  soldOut: "Sold out",
  allergens: "Allergens",
  dietary: "Dietary",
  spiceLevel: "Spice level",
  notSpicy: "Not spicy",
  mildSpice: "Mildly spicy",
  mediumSpice: "Spicy",
  hotSpice: "Extremely spicy",
  excludeAllergens: "Exclude allergens",
  allergenFilterHelp: "Hide dishes with any selected allergen.",
  dietaryFilterHelp: "Show dishes with every selected dietary label.",
  clearFilters: "Clear filters",
  matchingItems: "Matching dishes",
  noFilterMatches: "No dishes match these filters.",
  items: "Menu items",
  emptyItems: "No menu items yet.",
  categories: "Categories",
  labels: "Labels",
  newItem: "New item",
  editItem: "Edit item",
  deleteItem: "Delete item",
  confirmDelete: "Delete permanently",
  deleteFilesFirst: "Remove this item's Drive files before deleting it.",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  error: "Could not save changes. Please try again.",
  loading: "Loading…",
  retry: "Retry",
  name: "Name",
  description: "Description",
  category: "Category",
  price: "Price",
  sizes: "Sizes",
  addSize: "Add size",
  sizeName: "Size name",
  removeSize: "Remove size",
  sizeHelp: "Translate size names in the selected language. The first size is the default price.",
  baseSizeNameRequired: "Enter every size name in the base language.",
  position: "Display order",
  reorder: "Reorder item",
  reorderHelp: "Drag a handle to reorder items, or focus it and use the Up and Down arrow keys.",
  reorderSearchHelp: "Clear the search to reorder items.",
  visible: "Visible on menu",
  unavailable: "Sold out",
  photo: "Photo",
  selectPhoto: "Use as photo",
  removePhoto: "Remove photo",
  language: "Language",
  baseNameRequired: "Enter a name in the base language.",
  back: "Back to items",
  newCategory: "New category",
  editCategory: "Edit category",
  newLabel: "New label",
  editLabel: "Edit label",
  labelKind: "Label type",
  icon: "Icon",
  automaticIcon: "Automatic",
  iconNames: {
    leaf: "Leaf",
    vegan: "Vegan",
    fish: "Fish",
    wheat: "Wheat",
    milk: "Milk",
    egg: "Egg",
    nut: "Nut",
    bean: "Bean",
    sprout: "Sprout",
    shrimp: "Shrimp",
    shell: "Shell",
    carrot: "Carrot",
    flower: "Flower",
    seeds: "Seeds",
    wine: "Wine glass",
    check: "Check badge",
  },
  deleteCategory: "Delete category",
  deleteLabel: "Delete label",
  yes: "Yes",
  no: "No",
} satisfies MenusLabels;
