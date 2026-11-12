"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { NativeSelect } from "@/components/native-select";
import {
  MenuCardPreview,
  MenuCardPage,
  isMenuCardPublic,
  MenuWorkspace,
  MenuItemEditorPage,
  MenuItemsPage,
  MenuPage,
  MenuPrintPage,
  MenuTaxonomyPage,
  buildMenu,
  buildMenuCard,
  menuLabelPresets,
  type MenuCard,
  type MenuCardsClient,
  type MenuCategory,
  type MenuItem,
  type MenuLabel,
  type MenusClient,
} from "@/components/plugins/menus";
import {
  nextWeekDates,
  placeMenuItems,
  reorderMenuItems,
  validateLabel,
  visibleMenuCategoryIds,
  weeklyCourses,
} from "@/components/plugins/menus/model";
import { MenuConfirmation } from "@/components/plugins/menus/ui";
import { createDriveMock } from "@/showroom/drive-mock";
import {
  ShowroomLink as Link,
  useShowroomParams,
  useShowroomEditorGuard,
} from "@/showroom/routing";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const editable = { upload: true, createFolder: true, rename: true, delete: true, download: true };
const baseLocale = "en";
const locales = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];

const softDrinks = [
  "Soft drinks",
  [
    ["Homemade lemonade", 650],
    ["Apple juice", 550],
  ],
] as const;

const menuSamples = [
  {
    id: "seasonal",
    name: "Seasonal menu",
    description: "A sample dinner menu.",
    displayMode: "photos",
    sections: [
      [
        "Starters",
        [
          ["Burrata with tomatoes", 1450],
          ["Roasted beet salad", 1100],
        ],
      ],
      [
        "Main courses",
        [
          ["Herb-roasted chicken", 2650],
          ["Mushroom risotto", 2350],
        ],
      ],
      [
        "Desserts",
        [
          ["Lemon tart", 850],
          ["Chocolate mousse", 950],
        ],
      ],
    ],
  },
  {
    id: "lunch",
    name: "Lunch menu",
    description: "A small menu for a weekday lunch.",
    displayMode: "lines",
    sections: [
      [
        "Small plates",
        [
          ["Tomato soup", 950],
          ["Green salad", 850],
          ["Marinated olives", 650],
        ],
      ],
      [
        "Lunch plates",
        [
          ["Grilled cheese", 1450],
          ["Lentil bowl", 1650],
          ["Fish sandwich", 1850],
        ],
      ],
      softDrinks,
    ],
  },
  {
    id: "drinks",
    name: "Drinks menu",
    description: "Alcohol-free drinks and hot drinks.",
    displayMode: "lines",
    sections: [
      softDrinks,
      [
        "Hot drinks",
        [
          ["Espresso", 350],
          ["Mint tea", 450],
        ],
      ],
    ],
  },
] as const;

function createMock(composed = false) {
  const drive = createDriveMock([
    {
      id: "40000000-0000-4000-8000-000000000001",
      scope: { type: "menu-item", id: "30000000-0000-4000-8000-000000000001" },
      parentId: null,
      kind: "file",
      name: "burrata-with-tomatoes.png",
      size: 1380907,
      contentType: "image/png",
      updatedAt: "2026-10-08T00:00:00Z",
      state: "ready",
      url: "/showroom/menus/burrata-with-tomatoes.png",
    },
  ]);
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
  let labels: MenuLabel[] = menuLabelPresets.map(({ id, kind, position, translations }) => ({
    id,
    kind,
    position,
    translations: { ...translations },
  }));
  let items: MenuItem[] = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      version: 1,
      categoryId: categories[0].id,
      priceMinor: 1450,
      position: 0,
      visible: true,
      soldOut: false,
      imageEntryId: "40000000-0000-4000-8000-000000000001",
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
      sizes: [
        {
          id: "regular",
          priceMinor: 2850,
          translations: { en: "Regular", fr: "Normale", de: "Normal", it: "Normale" },
        },
        {
          id: "large",
          priceMinor: 3450,
          translations: { en: "Large", fr: "Grande", de: "Groß", it: "Grande" },
        },
      ],
      position: 0,
      visible: true,
      soldOut: true,
      spiceLevel: 2,
      imageEntryId: null,
      labelIds: [labels[0].id, labels[2].id, labels[3].id],
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
  let cards: MenuCard[] = [];
  const nextWeeks = new Map<string, MenuCard>();
  if (composed) {
    const [burrata, pasta] = items;
    const byName = new Map<string, MenuCategory>();
    const dishList: MenuItem[] = [];
    const uuid = (prefix: string, index: number) =>
      `${prefix}0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    cards = menuSamples.map((sample, position) => ({
      id: uuid("5", position),
      version: 1,
      position,
      translations: { en: { name: sample.name, description: sample.description } },
      categoryIds: sample.sections.map(([name, dishes]) => {
        const existing = byName.get(name);
        if (existing) return existing.id;
        const category = {
          id: uuid("1", byName.size),
          version: 1,
          position: byName.size,
          translations: { en: name },
        };
        byName.set(name, category);
        dishes.forEach(([name, priceMinor], position) => {
          const id = uuid("3", dishList.length);
          dishList.push({
            id,
            version: 1,
            categoryId: category.id,
            priceMinor,
            position,
            visible: true,
            soldOut: false,
            imageEntryId: id === burrata.id ? burrata.imageEntryId : null,
            labelIds:
              name === "Burrata with tomatoes"
                ? burrata.labelIds
                : name === "Mushroom risotto"
                  ? pasta.labelIds.slice(2)
                  : [],
            translations:
              id === burrata.id ? burrata.translations : { en: { name, description: "" } },
          });
        });
        return category.id;
      }),
      displayMode: sample.displayMode,
      published: true,
      startDate: null,
      endDate: null,
    }));
    categories = [...byName.values()];
    items = dishList;
  }
  const getCard = (id: string, version?: number) => {
    const card = cards.find((entry) => entry.id === id);
    if (!card || (version !== undefined && card.version !== version)) throw new Error("Conflict");
    return card;
  };
  const putCard = (card: MenuCard) => {
    cards = [...cards.filter((entry) => entry.id !== card.id), card].sort(
      (a, b) => a.position - b.position,
    );
  };
  const weeklyCategories = (card: MenuCard) => {
    const sections = [...(card.weeklySections ?? [])];
    for (const day of card.weekdays ?? []) {
      for (const course of weeklyCourses) {
        if (sections.some((section) => section.day === day && section.course === course)) continue;
        const categoryId = crypto.randomUUID();
        categories.push({
          id: categoryId,
          version: 1,
          position: categories.length,
          translations: { en: { starter: "Starters", main: "Mains", dessert: "Desserts" }[course] },
        });
        sections.push({ categoryId, day, course });
      }
    }
    return {
      ...card,
      weeklySections: sections,
      categoryIds: sections.map((section) => section.categoryId),
    };
  };
  const listeners = new Set<() => void>();
  let revision = 0;
  let fail = false;
  let listState = "ready";
  const emit = () => {
    revision++;
    listeners.forEach((listener) => listener());
  };
  const mutate = async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (fail) throw new Error("Simulated storage failure");
  };
  const client: MenusClient & MenuCardsClient = {
    async listCards() {
      return structuredClone(cards);
    },
    async saveCard(input) {
      await mutate();
      const existing = input.id ? getCard(input.id, input.version) : undefined;
      let card = {
        ...structuredClone(input),
        id: existing?.id ?? crypto.randomUUID(),
        version: (existing?.version ?? 0) + 1,
      };
      if (card.kind === "weekly") card = weeklyCategories(card);
      putCard(card);
      emit();
      return structuredClone(card);
    },
    async removeCard(id, version) {
      await mutate();
      getCard(id, version);
      cards = cards.filter((card) => card.id !== id);
      emit();
    },
    async listItems(id) {
      const categoryIds = visibleMenuCategoryIds(getCard(id));
      return structuredClone(
        items.filter((item) => item.categoryId !== null && categoryIds.includes(item.categoryId)),
      ).sort((a, b) => a.position - b.position);
    },
    async placeItems(groups) {
      await mutate();
      const moved = placeMenuItems(items, groups);
      const byId = new Map(moved.map((item) => [item.id, item]));
      items = items.map((item) => byId.get(item.id) ?? item);
      emit();
      return structuredClone(moved);
    },
    async nextWeek(id, version, requestId) {
      await mutate();
      const replay = nextWeeks.get(requestId);
      if (replay) return structuredClone(replay);
      const source = getCard(id, version);
      if (source.kind !== "weekly" || !source.endDate || !source.weekdays?.length)
        throw new Error("Missing weekly dates");
      const card = weeklyCategories({
        ...source,
        ...nextWeekDates(source.endDate, source.weekdays),
        id: crypto.randomUUID(),
        version: 1,
        position: Math.max(-1, ...cards.map(({ position }) => position)) + 1,
        published: false,
        weeklySections: [],
        categoryIds: [],
      });
      putCard(card);
      nextWeeks.set(requestId, card);
      emit();
      return structuredClone(card);
    },
    async list() {
      return structuredClone(items).sort(
        (a, b) => a.position - b.position || a.id.localeCompare(b.id),
      );
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
      return structuredClone(
        [...labels].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
      );
    },
    async create(input, options) {
      await mutate();
      const item = {
        ...structuredClone(input),
        id: crypto.randomUUID(),
        version: 1,
        visible: options?.visibleOnCreate === true && input.visible,
        imageEntryId: null,
      };
      items = [...items, item];
      emit();
      return structuredClone(item);
    },
    async save(id, version, input) {
      await mutate();
      const current = items.find((item) => item.id === id);
      if (!current || current.version !== version) throw new Error("Conflict");
      if (
        input.categoryId !== null &&
        !categories.some((category) => category.id === input.categoryId)
      )
        throw new Error("Missing category");
      const item = { ...structuredClone(input), id, version: version + 1 };
      items = items.map((entry) => (entry.id === id ? item : entry));
      emit();
      return structuredClone(item);
    },
    async reorder(order) {
      await mutate();
      items = reorderMenuItems(items, order);
      emit();
      return structuredClone(items);
    },
    async remove(id, scope) {
      await mutate();
      const item = items.find((entry) => entry.id === id);
      if (!item) throw new Error("Missing item");
      if (
        scope &&
        (item.version !== scope.version ||
          ("categoryId" in scope
            ? item.categoryId !== null
            : item.categoryId === null ||
              !getCard(scope.menuId).categoryIds.includes(item.categoryId)))
      )
        throw new Error("Conflict");
      if (item.imageEntryId) throw new Error("In use");
      drive.assertEmpty({ type: "menu-item", id });
      items = items.filter((item) => item.id !== id);
      emit();
    },
    async saveCategory(input) {
      await mutate();
      const existing = categories.find((entry) => entry.id === input.id);
      if (
        input.id &&
        (!existing || (input.version !== undefined && existing.version !== input.version))
      )
        throw new Error("Conflict");
      const card = input.menu ? getCard(input.menu.id, input.menu.version) : undefined;
      const { position, translations, descriptions } = input;
      const category = {
        id: input.id ?? crypto.randomUUID(),
        version: (existing?.version ?? 0) + 1,
        position,
        translations,
        descriptions,
      };
      if (card && !card.categoryIds.includes(category.id))
        putCard({
          ...card,
          version: card.version + 1,
          categoryIds: [...card.categoryIds, category.id],
        });
      categories = [...categories.filter((entry) => entry.id !== category.id), category];
      emit();
      return structuredClone(category);
    },
    async removeCategory(id, menu, options) {
      await mutate();
      const current = menu ? getCard(menu.id, menu.version) : undefined;
      const members = items.filter((item) => item.categoryId === id);
      if (
        !categories.some((category) => category.id === id) ||
        (current && (!current.categoryIds.includes(id) || current.kind === "weekly")) ||
        (!options && members.length > 0) ||
        cards.some((card) => card.id !== current?.id && card.categoryIds.includes(id))
      )
        throw new Error("In use");
      if (
        options &&
        (options.items?.length !== members.length ||
          new Set(options.items.map((item) => item.id)).size !== members.length ||
          members.some(
            (item) =>
              !options.items?.some(
                (expected) => expected.id === item.id && expected.version === item.version,
              ),
          ))
      )
        throw new Error("Conflict");
      if (options?.deleteItems) {
        for (const item of members) {
          if (item.imageEntryId) throw new Error("In use");
          drive.assertEmpty({ type: "menu-item", id: item.id });
        }
      }
      items = options?.deleteItems
        ? items.filter((item) => item.categoryId !== id)
        : items.map((item) =>
            item.categoryId === id
              ? { ...item, categoryId: null, version: item.version + 1 }
              : item,
          );
      if (current)
        putCard({
          ...current,
          version: current.version + 1,
          categoryIds: current.categoryIds.filter((categoryId) => categoryId !== id),
        });
      categories = categories.filter((category) => category.id !== id);
      emit();
    },
    async saveLabel(input) {
      await mutate();
      const label = {
        id: input.id ?? crypto.randomUUID(),
        ...validateLabel(input, baseLocale),
        icon:
          input.icon === undefined
            ? (labels.find((label) => label.id === input.id)?.icon ?? null)
            : input.icon,
      };
      labels = [...labels.filter((entry) => entry.id !== label.id), label];
      emit();
      return structuredClone(label);
    },
    async removeLabel(id) {
      await mutate();
      if (items.some((item) => item.labelIds.includes(id))) throw new Error("In use");
      labels = labels.filter((label) => label.id !== id);
      emit();
    },
  };
  return {
    drive,
    get cards() {
      return cards;
    },
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
    get listState() {
      return listState;
    },
    setListState(value: string) {
      listState = value;
      emit();
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

const Context = createContext<{
  mock: ReturnType<typeof createMock>;
  legacy: ReturnType<typeof createMock>;
  workspace: ReturnType<typeof createMock>;
} | null>(null);
function useMock(mode: "mock" | "legacy" | "workspace" = "mock") {
  const mock = useContext(Context)?.[mode];
  if (!mock) throw new Error("Missing menus preview provider");
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  return mock;
}

export function MenusPreviewProvider({ children }: { children: ReactNode }) {
  const [legacy] = useState(() => createMock());
  const [workspace] = useState(() => createMock(true));
  useEffect(
    () => () => {
      legacy.drive.dispose();
      workspace.drive.dispose();
    },
    [legacy, workspace],
  );
  const { locale, segments } = useShowroomParams();
  const current = segments[0];
  const mock =
    !current ||
    current === "menu" ||
    current === "create-menu" ||
    current === "labels" ||
    current === "unassigned"
      ? workspace
      : legacy;
  useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  return (
    <Context.Provider value={{ mock, legacy, workspace }}>
      <ShowroomPreview
        notice={previewDataNotice}
        navigation={
          <>
            <Link href={`/${locale}/menus`}>Public menu</Link>
            <Link href={`/${locale}/menus/showcase`}>Published menus</Link>
            <Link href={`/${locale}/admin/menus`}>Manage menu</Link>
            {mock === workspace && workspace.cards.length > 0 && (
              <ul className="space-y-2 border-l border-border pl-3">
                {workspace.cards.map((menu) => (
                  <li key={menu.id}>
                    <Link
                      href={`/${locale}/admin/menus/menu/${menu.id}`}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                          return;
                        const href = `/${locale}/admin/menus/menu/${menu.id}`;
                        if (window.location.pathname.replace(/\/$/, "") !== href) return;
                        const target = document.getElementById(`factory-menu-${menu.id}`);
                        if (target) {
                          event.preventDefault();
                          target.scrollIntoView({ block: "start" });
                        }
                      }}
                    >
                      {menu.translations.en?.name ?? Object.values(menu.translations)[0]?.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/${locale}/admin/menus/items`}>Item list</Link>
            <Link href="/fr/menus">French menu</Link>
          </>
        }
        controls={
          <>
            {current === "items" && (
              <div className="grid gap-2">
                <label htmlFor="factory-menu-directory-state">Directory state</label>
                <NativeSelect
                  id="factory-menu-directory-state"
                  value={mock.listState}
                  onChange={(event) => mock.setListState(event.target.value)}
                >
                  <option value="ready">Ready</option>
                  <option value="loading">Loading</option>
                  <option value="empty">Empty</option>
                  <option value="error">Error</option>
                </NativeSelect>
              </div>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mock.fail}
                onChange={(event) => mock.setFail(event.target.checked)}
              />
              Simulate action failures
            </label>
          </>
        }
      >
        {children}
      </ShowroomPreview>
    </Context.Provider>
  );
}

export function MenuPublicPreview() {
  const { segments } = useShowroomParams();
  return segments[0] === "showcase" ? <ComposedPublicPreview /> : <FlatPublicPreview />;
}

function ComposedPublicPreview() {
  const mock = useMock("workspace");
  const { locale } = useShowroomParams();
  const [open, setOpen] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const menus = mock.cards.filter((menu) => isMenuCardPublic(menu, today));
  useLayoutEffect(() => {
    trigger.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  return (
    <section className="showroom-page mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Our menus</h1>
      {menus.length === 0 && <p className="text-muted-foreground">Menus are being prepared.</p>}
      {menus.map((menu) => {
        const view = buildMenuCard(
          menu,
          mock.items,
          mock.categories,
          mock.labels,
          locale,
          baseLocale,
        );
        const expanded = open === menu.id;
        return (
          <section key={menu.id} className="border-t border-border">
            <h2>
              <button
                id={`factory-public-menu-trigger-${menu.id}`}
                aria-controls={`factory-public-menu-panel-${menu.id}`}
                aria-expanded={expanded}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 px-3 text-left font-serif text-lg font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setOpen(expanded ? undefined : menu.id);
                }}
              >
                {view.card.name}
                <ChevronDownIcon
                  className={expanded ? "size-4 rotate-180" : "size-4"}
                  aria-hidden="true"
                />
              </button>
            </h2>
            <div
              id={`factory-public-menu-panel-${menu.id}`}
              aria-labelledby={`factory-public-menu-trigger-${menu.id}`}
              hidden={!expanded}
            >
              {expanded && (
                <MenuCardPage
                  view={view}
                  locale={locale}
                  currency="CHF"
                  hideHeading
                  sectionHeadingLevel={3}
                  imageUrl={(itemId) =>
                    mock.drive.fileUrl(
                      { type: "menu-item", id: itemId },
                      mock.items.find((item) => item.id === itemId)?.imageEntryId ?? "",
                    )
                  }
                />
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}

function FlatPublicPreview() {
  const mock = useMock("legacy");
  const { locale } = useShowroomParams();
  const sections = buildMenu(mock.items, mock.categories, mock.labels, locale, baseLocale);
  return (
    <MenuPage
      sections={sections}
      locale={locale}
      currency="CHF"
      imageUrl={(itemId) =>
        mock.drive.fileUrl(
          { type: "menu-item", id: itemId },
          mock.items.find((item) => item.id === itemId)?.imageEntryId ?? "",
        )
      }
      className="showroom-page [--menu-top-offset:var(--showroom-top-offset)] [&_img[src='/showroom/menus/burrata-with-tomatoes.png']]:object-contain [&_img[src='/showroom/menus/burrata-with-tomatoes.png']]:mix-blend-multiply dark:[&_img[src='/showroom/menus/burrata-with-tomatoes.png']]:mix-blend-screen dark:[&_img[src='/showroom/menus/burrata-with-tomatoes.png']]:invert"
      labels={
        locale === "fr"
          ? {
              categories: "Catégories",
              sizes: "Tailles",
              price: "Prix",
              allergens: "Allergènes",
              dietary: "Régimes alimentaires",
              mildSpice: "Peu épicé",
              mediumSpice: "Épicé",
              hotSpice: "Extrêmement épicé",
              excludeAllergens: "Exclure les allergènes",
              allergenFilterHelp: "Masquer les plats contenant un allergène sélectionné.",
              dietaryFilterHelp: "Afficher les plats avec tous les régimes sélectionnés.",
              clearFilters: "Effacer les filtres",
              matchingItems: "Plats correspondants",
              noFilterMatches: "Aucun plat ne correspond à ces filtres.",
            }
          : undefined
      }
    />
  );
}

export function MenuAdminPreview() {
  const mock = useMock();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const listState = mock.listState;
  const listClient = useMemo<MenusClient>(
    () => ({
      ...mock.client,
      list: async () => {
        if (listState === "loading") return new Promise<MenuItem[]>(() => {});
        if (listState === "error") throw new Error("Simulated listing failure");
        return listState === "empty" ? [] : mock.client.list();
      },
    }),
    [mock, listState],
  );
  const { locale, segments } = useShowroomParams();
  const navigate = useNavigate();
  const query = useSearch({ strict: false });
  const directory = `/${locale}/admin/menus`;
  const scoped = segments[0] === "menu";
  const unassigned = segments[0] === "unassigned";
  const menuId = scoped ? segments[1] : undefined;
  const menu = mock.cards.find((entry) => entry.id === menuId);
  const base = scoped
    ? `${directory}/menu/${menuId}`
    : unassigned
      ? `${directory}/unassigned`
      : directory;
  const backHref = menuId
    ? `${directory}/menu/${menuId}`
    : unassigned
      ? directory
      : `${directory}/items`;
  const id = scoped ? segments[2] : unassigned ? segments[1] : segments[0];
  const item = mock.items.find(
    (entry) =>
      entry.id === id &&
      (!menu || (entry.categoryId !== null && menu.categoryIds.includes(entry.categoryId))),
  );
  const { onNavigationStateChange, blockedNavigation } = useShowroomEditorGuard();
  const fail = mock.fail;
  const driveClient = useMemo(
    () =>
      mock.drive.client(
        () =>
          mock.items.map((entry) => ({
            scope: { type: "menu-item", id: entry.id },
            name: entry.translations.en?.name ?? "Menu item",
            capabilities: editable,
          })),
        fail,
        "ready",
      ),
    [mock, fail],
  );
  const [photoPrompt, setPhotoPrompt] = useState<string>();
  const [photoPending, setPhotoPending] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  async function enablePhotos() {
    if (photoPending || !menu || menu.id !== photoPrompt) return;
    setPhotoPending(true);
    setPhotoError(false);
    try {
      await mock.client.saveCard({ ...menu, displayMode: "photos" });
      setPhotoPrompt(undefined);
    } catch {
      setPhotoError(true);
    } finally {
      setPhotoPending(false);
    }
  }
  if ((!id || id === "create-menu" || (scoped && id === "settings")) && (!scoped || menu)) {
    return (
      <MenuWorkspace
        client={mock.client}
        locale={locale}
        baseLocale={baseLocale}
        locales={locales}
        currency="CHF"
        today={today}
        labelsHref={`${directory}/labels`}
        unassignedDishHref={(id) => `${directory}/unassigned/${id}`}
        unassignedSearch={
          query.menuSearch === "unassigned" && typeof query.menuQuery === "string"
            ? query.menuQuery
            : ""
        }
        onUnassignedSearchChange={(value) =>
          void navigate({
            from: "/$locale/admin/menus/$",
            search: {
              ...query,
              menuSearch: value ? "unassigned" : undefined,
              menuQuery: value || undefined,
            },
            resetScroll: false,
            replace: true,
          })
        }
        search={
          typeof query.menuSearch === "string" && typeof query.menuQuery === "string"
            ? { menuId: query.menuSearch, value: query.menuQuery }
            : undefined
        }
        onSearchChange={(menuId, value) =>
          void navigate({
            from: "/$locale/admin/menus/$",
            search: {
              ...query,
              menuSearch: value ? menuId : undefined,
              menuQuery: value || undefined,
            },
            resetScroll: false,
            replace: true,
          })
        }
        previewHref={(id) => `${directory}/menu/${id}/preview`}
        dishHref={(id, itemId, categoryId) =>
          `${directory}/menu/${id}/${itemId ?? "new"}${categoryId ? `?category=${categoryId}` : ""}`
        }
        initialMenuId={menuId}
        initialCreate={id === "create-menu"}
        blockedNavigation={blockedNavigation}
        initialSettingsMenuId={id === "settings" ? menuId : undefined}
        key={
          id === "settings"
            ? `settings-${menuId}`
            : id === "create-menu"
              ? "create-menu"
              : "menu-workspace"
        }
        onNavigationStateChange={onNavigationStateChange}
        linkComponent={Link}
        className="showroom-page [--menu-workspace-top:var(--showroom-top-offset)]"
      />
    );
  }
  if (scoped && !menu) return <p role="alert">Menu not found.</p>;
  if (id === "card-preview" || (id === "preview" && menu)) {
    const view = buildMenuCard(
      menu ?? {
        id: "showroom-card",
        version: 1,
        position: 0,
        translations: { en: { name: "Seasonal menu", description: "A sample dinner menu." } },
        categoryIds: mock.categories.slice(0, 2).map((category) => category.id),
        published: false,
        displayMode: "photos",
        startDate: null,
        endDate: null,
      },
      mock.items,
      mock.categories,
      mock.labels,
      locale,
      baseLocale,
    );
    return (
      <div className="showroom-page space-y-4">
        {menu && (
          <div>
            <Link href={backHref}>Back to menu</Link>
            <h1 className="mt-3 text-2xl font-semibold">Preview menu</h1>
            <p className="text-sm text-muted-foreground">Private preview of the saved menu.</p>
          </div>
        )}
        <MenuCardPreview
          view={view}
          web={{
            locale,
            currency: "CHF",
            imageUrl: (itemId) =>
              mock.drive.fileUrl(
                { type: "menu-item", id: itemId },
                mock.items.find((entry) => entry.id === itemId)?.imageEntryId ?? "",
              ),
          }}
          paper={{
            locale,
            currency: "CHF",
            restaurantName: "Acme restaurant",
            backHref,
            linkComponent: Link,
          }}
        />
      </div>
    );
  }
  if (id === "print")
    return (
      <MenuPrintPage
        key={locale}
        sections={buildMenu(mock.items, mock.categories, mock.labels, locale, baseLocale)}
        locale={locale}
        currency="CHF"
        restaurantName="Acme restaurant"
        backHref={backHref}
        linkComponent={Link}
        className="showroom-page"
        labels={
          locale === "fr"
            ? {
                menu: "La carte",
                printMenu: "Imprimer le menu",
                print: "Imprimer / Enregistrer en PDF",
                preparingPrint: "Préparation de l'impression…",
                printSettings: "Paramètres d'impression",
                paperSize: "Format du papier",
                menuTitle: "Titre du menu",
                footerText: "Texte de pied de page (facultatif)",
                printHelp:
                  "Imprimez tous les plats visibles. Choisissez A4 portrait ou A5 paysage et une échelle de 100 %, puis désactivez les en-têtes et pieds de page du navigateur. Vous pouvez aussi enregistrer un PDF. Ces paramètres ne sont pas conservés.",
                printError:
                  "Impossible de préparer l'impression. Vérifiez le chargement du logo et des styles, puis réessayez.",
                printPreview: "Aperçu du menu à imprimer",
                emptyPrintMenu:
                  "Aucun plat visible à imprimer. Rendez d'abord un plat visible dans la gestion du menu.",
                back: "Retour aux plats",
                soldOut: "Épuisé",
                mildSpice: "Peu épicé",
                mediumSpice: "Épicé",
                hotSpice: "Extrêmement épicé",
              }
            : undefined
        }
      />
    );
  if (id === "taxonomy" || id === "labels")
    return (
      <MenuTaxonomyPage
        onNavigationStateChange={onNavigationStateChange}
        blockedNavigation={blockedNavigation}
        client={mock.client}
        locales={locales}
        baseLocale={baseLocale}
        backHref={id === "labels" ? directory : backHref}
        labelsOnly={id === "labels"}
        labels={
          id === "labels"
            ? {
                allergensAndPreferences: "Allergens and preferences",
                dietary: "Dietary preferences",
              }
            : undefined
        }
        linkComponent={Link}
        className="showroom-page"
      />
    );
  if (id === "new" || item)
    return (
      <>
        <MenuItemEditorPage
          onNavigationStateChange={onNavigationStateChange}
          blockedNavigation={blockedNavigation}
          client={mock.client}
          item={item}
          categories={
            menu
              ? mock.categories.filter((category) =>
                  visibleMenuCategoryIds(menu).includes(category.id),
                )
              : mock.categories
          }
          visibleOnCreate={scoped}
          initialCategoryId={typeof query.category === "string" ? query.category : undefined}
          displayLocale={scoped ? locale : undefined}
          currencyLabel={menu?.currencyLabel}
          photoSettingsHref={menu && menu.kind !== "weekly" ? `${base}/settings` : undefined}
          labelsData={mock.labels}
          locales={locales}
          baseLocale={baseLocale}
          currency="CHF"
          backHref={backHref}
          labelsHref={`${directory}/${scoped || unassigned ? "labels" : "taxonomy"}`}
          linkComponent={Link}
          className="showroom-page"
          driveClient={driveClient}
          driveTransfer={mock.drive.transfer}
          photoFolderId={typeof query.folder === "string" ? query.folder : null}
          getFolderHref={(folderId) => `${base}/${id}${folderId ? `?folder=${folderId}` : ""}`}
          onSaved={(saved, photoAdded) => {
            if (
              !blockedNavigation &&
              photoAdded &&
              menu &&
              menu.kind !== "weekly" &&
              menu.displayMode !== "photos"
            ) {
              setPhotoError(false);
              setPhotoPrompt(menu.id);
            }
            if (id === "new" && !blockedNavigation)
              void navigate({ to: `${base}/${saved.id}`, ignoreBlocker: true });
          }}
        />
        <MenuConfirmation
          open={!!menu && menu.id === photoPrompt}
          title="Show photos in this menu?"
          description="The photo is saved. This setting applies to the whole menu."
          confirm="Show photos"
          cancel="Keep lines"
          pending={photoPending}
          error={photoError ? "Could not change the display. The photo is still saved." : undefined}
          onCancel={() => setPhotoPrompt(undefined)}
          onConfirm={() => void enablePhotos()}
        />
      </>
    );
  if (id !== "items") return <p role="alert">Menu item not found.</p>;
  return (
    <MenuItemsPage
      client={listClient}
      baseLocale={baseLocale}
      newHref={`${base}/new`}
      taxonomyHref={`${base}/taxonomy`}
      printHref={`${base}/print`}
      getEditHref={(entry) => `${base}/${entry.id}`}
      linkComponent={Link}
      className="showroom-page"
    />
  );
}
