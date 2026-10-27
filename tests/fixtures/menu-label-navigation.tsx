import { createRoot } from "react-dom/client";

import { MenuItemEditorPage } from "@/components/plugins/menus";
import type { MenuItem, MenuItemInput, MenusClient } from "@/components/plugins/menus/types";

import "../../src/styles/globals.css";

const item: MenuItem = {
  id: "dish",
  version: 1,
  categoryId: "food",
  position: 0,
  priceMinor: 1000,
  visible: true,
  soldOut: false,
  imageEntryId: "photo",
  labelIds: [],
  translations: { en: { name: "Dish", description: "Description" } },
};
const calls: { input: MenuItemInput; id?: string; resolve: () => void; reject: () => void }[] = [];
const saved: MenuItem[] = [];
function request(input: MenuItemInput, id?: string, version = 0) {
  return new Promise<MenuItem>((resolve, reject) => {
    calls.push({
      input: structuredClone(input),
      id,
      resolve: () => resolve({ ...input, id: id ?? "created", version: version + 1 }),
      reject: () => reject(new Error("Save failed")),
    });
  });
}
const unused = async () => {
  throw new Error("Unused operation");
};
const client: MenusClient = {
  create: (input) => request(input),
  save: (id, version, input) => request(input, id, version),
  list: unused,
  get: unused,
  remove: unused,
  categories: unused,
  labels: unused,
  saveCategory: unused,
  removeCategory: unused,
  saveLabel: unused,
  removeLabel: unused,
};
const root = createRoot(document.getElementById("root")!);
declare global {
  interface Window {
    menuLabelTest: { calls: typeof calls; saved: MenuItem[]; unmount: () => void };
  }
}
window.menuLabelTest = { calls, saved, unmount: () => root.unmount() };
root.render(
  <MenuItemEditorPage
    client={client}
    item={new URLSearchParams(location.search).has("new") ? undefined : item}
    categories={[
      { id: "food", position: 0, translations: { en: "Food" } },
      { id: "drinks", position: 1, translations: { en: "Drinks" } },
    ]}
    labelsData={[{ id: "vegan", kind: "dietary", position: 0, translations: { en: "Vegan" } }]}
    locales={[
      { code: "en", name: "English" },
      { code: "fr", name: "French" },
    ]}
    baseLocale="en"
    currency="CHF"
    backHref="#back"
    labelsHref="#labels"
    onSaved={(result) => saved.push(result)}
  />,
);
