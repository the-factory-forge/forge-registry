"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  MenuItemEditorPage,
  MenuItemsPage,
  MenuPage,
  MenuTaxonomyPage,
  buildMenu,
  type MenuCategory,
  type MenuItem,
  type MenuLabel,
  type MenusClient,
} from "@/components/plugins/menus";
import { createDriveMock } from "@/showroom/drive-mock";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

const editable = { upload: true, createFolder: true, rename: true, delete: true, download: true };
const baseLocale = "en";
const locales = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];

function createMock() {
  const drive = createDriveMock();
  let categories: MenuCategory[] = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      position: 0,
      translations: { en: "Starters", fr: "Entrées" },
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      position: 1,
      translations: { en: "Main courses", fr: "Plats principaux" },
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      position: 2,
      translations: { en: "Drinks", fr: "Boissons" },
    },
  ];
  let labels: MenuLabel[] = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      kind: "dietary",
      position: 0,
      translations: { en: "Vegetarian", fr: "Végétarien" },
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      kind: "allergen",
      position: 1,
      translations: { en: "Milk", fr: "Lait" },
    },
    {
      id: "20000000-0000-4000-8000-000000000003",
      kind: "allergen",
      position: 2,
      translations: { en: "Gluten", fr: "Gluten" },
    },
  ];
  let items: MenuItem[] = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      version: 1,
      categoryId: categories[0].id,
      priceMinor: 1450,
      position: 0,
      visible: true,
      soldOut: false,
      imageEntryId: null,
      labelIds: [labels[0].id, labels[1].id],
      translations: {
        en: { name: "Burrata with tomatoes", description: "Basil, olive oil, and toasted bread." },
        fr: { name: "Burrata aux tomates", description: "Basilic, huile d'olive et pain grillé." },
      },
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      version: 1,
      categoryId: categories[1].id,
      priceMinor: 2850,
      position: 0,
      visible: true,
      soldOut: true,
      imageEntryId: null,
      labelIds: [labels[2].id],
      translations: {
        en: { name: "House pasta", description: "Seasonal vegetables and herb sauce." },
      },
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      version: 1,
      categoryId: categories[2].id,
      priceMinor: 650,
      position: 0,
      visible: false,
      soldOut: false,
      imageEntryId: null,
      labelIds: [],
      translations: { en: { name: "Homemade lemonade", description: "Fresh lemon and mint." } },
    },
  ];
  const listeners = new Set<() => void>();
  let revision = 0;
  let fail = false;
  const emit = () => {
    revision++;
    listeners.forEach((listener) => listener());
  };
  const mutate = () => {
    if (fail) throw new Error("Simulated storage failure");
  };
  const client: MenusClient = {
    async list() {
      return structuredClone(items);
    },
    async get(id) {
      const item = items.find((entry) => entry.id === id);
      if (!item) throw new Error("Missing item");
      return structuredClone(item);
    },
    async categories() {
      return structuredClone(categories);
    },
    async labels() {
      return structuredClone(labels);
    },
    async create(input) {
      mutate();
      const item = {
        ...structuredClone(input),
        id: crypto.randomUUID(),
        version: 1,
        visible: false,
        imageEntryId: null,
      };
      items = [...items, item];
      emit();
      return structuredClone(item);
    },
    async save(id, version, input) {
      mutate();
      const current = items.find((item) => item.id === id);
      if (!current || current.version !== version) throw new Error("Conflict");
      const item = { ...structuredClone(input), id, version: version + 1 };
      items = items.map((entry) => (entry.id === id ? item : entry));
      emit();
      return structuredClone(item);
    },
    async remove(id) {
      mutate();
      drive.assertEmpty({ type: "menu-item", id });
      items = items.filter((item) => item.id !== id);
      emit();
    },
    async saveCategory(input) {
      mutate();
      const category = {
        id: input.id ?? crypto.randomUUID(),
        position: input.position,
        translations: input.translations,
      };
      categories = [...categories.filter((entry) => entry.id !== category.id), category];
      emit();
      return structuredClone(category);
    },
    async removeCategory(id) {
      mutate();
      if (items.some((item) => item.categoryId === id)) throw new Error("In use");
      categories = categories.filter((category) => category.id !== id);
      emit();
    },
    async saveLabel(input) {
      mutate();
      const label = {
        id: input.id ?? crypto.randomUUID(),
        kind: input.kind,
        position: input.position,
        translations: input.translations,
      };
      labels = [...labels.filter((entry) => entry.id !== label.id), label];
      emit();
      return structuredClone(label);
    },
    async removeLabel(id) {
      mutate();
      if (items.some((item) => item.labelIds.includes(id))) throw new Error("In use");
      labels = labels.filter((label) => label.id !== id);
      emit();
    },
  };
  return {
    drive,
    client,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => revision,
    get items() {
      return items;
    },
    get categories() {
      return categories;
    },
    get labels() {
      return labels;
    },
    setFail(value: boolean) {
      fail = value;
      emit();
    },
    get fail() {
      return fail;
    },
  };
}

const Context = createContext<ReturnType<typeof createMock> | null>(null);
function useMock() {
  const mock = useContext(Context);
  if (!mock) throw new Error("Missing menus preview provider");
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  return mock;
}

export function MenusPreviewProvider({ children }: { children: ReactNode }) {
  const [mock] = useState(createMock);
  const { locale } = useShowroomParams();
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  return (
    <Context.Provider value={mock}>
      <ShowroomPreview
        navigation={
          <>
            <Link href={`/${locale}/menus`}>Public menu</Link>
            <Link href={`/${locale}/admin/menus`}>Manage menu</Link>
            <Link href="/fr/menus">French menu</Link>
          </>
        }
        controls={
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mock.fail}
              onChange={(event) => mock.setFail(event.target.checked)}
            />
            Fail mutations
          </label>
        }
      >
        {children}
      </ShowroomPreview>
    </Context.Provider>
  );
}

export function MenuPublicPreview() {
  const mock = useMock();
  const { locale } = useShowroomParams();
  const sections = buildMenu(mock.items, mock.categories, mock.labels, locale, baseLocale);
  return <MenuPage sections={sections} locale={locale} currency="CHF" className="showroom-page" />;
}

export function MenuAdminPreview() {
  const mock = useMock();
  const { locale, segments } = useShowroomParams();
  const navigate = useNavigate();
  const query = useSearch({ strict: false });
  const base = `/${locale}/admin/menus`;
  const [id] = segments;
  const item = mock.items.find((entry) => entry.id === id);
  const driveClient = mock.drive.client(
    mock.items.map((entry) => ({
      scope: { type: "menu-item", id: entry.id },
      name: entry.translations.en?.name ?? "Menu item",
      capabilities: editable,
    })),
    mock.fail,
    "ready",
  );
  if (id === "taxonomy")
    return (
      <MenuTaxonomyPage
        client={mock.client}
        locales={locales}
        baseLocale={baseLocale}
        backHref={base}
        linkComponent={Link}
        className="showroom-page"
      />
    );
  if (id === "new" || item)
    return (
      <MenuItemEditorPage
        key={id}
        client={mock.client}
        item={item}
        categories={mock.categories}
        labelsData={mock.labels}
        locales={locales}
        baseLocale={baseLocale}
        currency="CHF"
        backHref={base}
        linkComponent={Link}
        className="showroom-page"
        driveClient={driveClient}
        driveTransfer={mock.drive.transfer}
        photoFolderId={typeof query.folder === "string" ? query.folder : null}
        getFolderHref={(folderId) => `${base}/${id}${folderId ? `?folder=${folderId}` : ""}`}
        onSaved={(saved) => {
          if (id === "new") void navigate({ to: `${base}/${saved.id}` });
        }}
      />
    );
  if (id) return <p role="alert">Menu item not found.</p>;
  return (
    <MenuItemsPage
      client={mock.client}
      baseLocale={baseLocale}
      newHref={`${base}/new`}
      taxonomyHref={`${base}/taxonomy`}
      getEditHref={(entry) => `${base}/${entry.id}`}
      linkComponent={Link}
      className="showroom-page"
    />
  );
}
