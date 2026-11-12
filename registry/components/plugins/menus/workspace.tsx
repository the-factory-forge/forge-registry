"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu as Dropdown } from "@base-ui/react/menu";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  LinkIcon,
  MoreHorizontalIcon,
  MoveIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TagIcon,
  Trash2Icon,
  UnlinkIcon,
  XIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link as DefaultLink, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import {
  localized,
  menuCardStatus,
  menuKinds,
  visibleMenuCategoryIds,
} from "@/components/plugins/menus/model";
import { menuPriceFormatter } from "@/components/plugins/menus/price";
import type {
  MenuCard,
  MenuCardInput,
  MenuCardsClient,
  MenuCategory,
  MenuItem,
  MenusClient,
} from "@/components/plugins/menus/types";
import {
  DeleteControl,
  field,
  iconButton,
  MenuConfirmation,
  outlineButton,
  primary,
} from "@/components/plugins/menus/ui";
import { moveMenuEntry, useMenuDrag } from "@/components/plugins/menus/use-menu-drag";
import { TableSearch, matchesTableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

type DraftState = { dirty: boolean; pending: boolean };
export interface MenuWorkspaceProps {
  client: MenusClient & MenuCardsClient;
  locale: string;
  baseLocale: string;
  locales: readonly { code: string; name: string }[];
  currency: string;
  /** Current calendar date in the host's time zone, as YYYY-MM-DD. */
  today: string;
  labelsHref: string;
  previewHref: (menuId: string) => string;
  dishHref: (menuId: string, itemId?: string, categoryId?: string) => string;
  linkComponent?: ComponentType<LinkProps>;
  copy?: (text: string) => string;
  staffKey?: string;
  search?: { menuId: string; value: string };
  onSearchChange?: (menuId: string, value: string) => void;
  unassignedDishHref?: (itemId: string) => string;
  unassignedSearch?: string;
  onUnassignedSearchChange?: (value: string) => void;
  initialCreate?: boolean;
  initialMenuId?: string;
  /** Open settings for the selected menu when entering the workspace. */
  initialSettingsMenuId?: string;
  blockedNavigation?: { proceed: () => void; reset: () => void };
  onNavigationStateChange?: (state: DraftState) => void;
  className?: string;
}

const workspaceKey = ["menus-workspace"] as const;
const identity = (text: string) => text;
const Workspace = createContext<
  | (MenuWorkspaceProps & {
      copy: (text: string) => string;
      linkComponent: ComponentType<LinkProps>;
      reportDraft: (id: string, state?: DraftState) => void;
    })
  | null
>(null);
function useWorkspace() {
  const context = useContext(Workspace);
  if (!context) throw new Error("Missing menu workspace.");
  return context;
}
const subscribeHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
}
function useMenuDraftGuard(dirty: boolean, pending: boolean) {
  const id = `factory-menu-draft-${useId()}`;
  const { reportDraft } = useWorkspace();
  useEffect(() => {
    if (!dirty && !pending) return;
    reportDraft(id, { dirty, pending });
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      reportDraft(id);
    };
  }, [dirty, pending, id, reportDraft]);
}

export function MenuWorkspace(props: MenuWorkspaceProps) {
  const createCache = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const [session, setSession] = useState(() => ({
    client: props.client,
    cache: createCache(),
    key: 0,
  }));
  if (session.client !== props.client) {
    setSession({ client: props.client, cache: createCache(), key: session.key + 1 });
  }
  return (
    <QueryClientProvider key={session.key} client={session.cache}>
      <ActionToastProvider>
        <WorkspaceContent {...props} />
      </ActionToastProvider>
    </QueryClientProvider>
  );
}

function WorkspaceContent(props: MenuWorkspaceProps) {
  const {
    client,
    locale,
    baseLocale,
    labelsHref,
    initialCreate,
    initialMenuId,
    onNavigationStateChange,
    className,
    copy = identity,
    linkComponent: Link = DefaultLink,
  } = props;
  const cache = useQueryClient();
  const drafts = useRef(new Map<string, DraftState>());
  const reportDraft = useCallback(
    (id: string, state?: DraftState) => {
      if (state) drafts.current.set(id, state);
      else drafts.current.delete(id);
      const current = [...drafts.current.values()];
      onNavigationStateChange?.({
        dirty: current.some((draft) => draft.dirty),
        pending: current.some((draft) => draft.pending),
      });
    },
    [onNavigationStateChange],
  );
  const mutable = useMemo(() => {
    const changed =
      <T, A extends unknown[]>(fn: (...args: A) => Promise<T>) =>
      async (...args: A) => {
        const result = await fn(...args);
        await cache.invalidateQueries({ queryKey: workspaceKey });
        return result;
      };
    return {
      ...client,
      listItems: (id: string) => client.listItems(id),
      saveCard: changed(client.saveCard.bind(client)),
      removeCard: changed(client.removeCard.bind(client)),
      saveCategory: changed(client.saveCategory.bind(client)),
      removeCategory: changed(client.removeCategory.bind(client)),
      placeItems: changed(client.placeItems.bind(client)),
      save: changed(client.save.bind(client)),
      remove: changed(client.remove.bind(client)),
      nextWeek: changed(client.nextWeek.bind(client)),
    };
  }, [client, cache]);
  const menus = useQuery({
    queryKey: [...workspaceKey, "list"],
    queryFn: () => client.listCards(),
  });
  const categories = useQuery({
    queryKey: [...workspaceKey, "categories"],
    queryFn: () => client.categories(),
  });
  const [creating, setCreating] = useState(!!initialCreate);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory>();
  const unassigned =
    categories.data?.filter(
      (category) => !menus.data?.some((menu) => menu.categoryIds.includes(category.id)),
    ) ?? [];
  const dishes = useQuery({
    queryKey: [...workspaceKey, "all-items"],
    queryFn: () => client.list(),
    enabled: showUnassigned,
  });
  const loaded = Boolean(menus.data && categories.data);
  useEffect(() => {
    if (!initialMenuId || !loaded) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`factory-menu-${initialMenuId}`)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialMenuId, loaded]);
  return (
    <Workspace.Provider
      value={{ ...props, client: mutable, copy, linkComponent: Link, reportDraft }}
    >
      {deletingCategory && (
        <DeleteCategoryDialog
          category={deletingCategory}
          onClose={() => setDeletingCategory(undefined)}
        />
      )}
      <MenuConfirmation
        open={Boolean(props.blockedNavigation)}
        title={copy("Discard your changes?")}
        description={copy("You have unsaved changes in this menu.")}
        confirm={copy("Discard changes")}
        cancel={copy("Keep editing")}
        destructive
        pending={false}
        onCancel={() => props.blockedNavigation?.reset()}
        onConfirm={() => props.blockedNavigation?.proceed()}
      />
      <div className={cn("mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:px-6", className)}>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-3xl font-semibold">{copy("Menus")}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              onClick={() => setCreating((value) => !value)}
            >
              <PlusIcon aria-hidden="true" />
              {copy("Menu")}
            </button>
            <Link href={labelsHref} className={outlineButton}>
              <TagIcon aria-hidden="true" />
              {copy("Allergens and preferences")}
            </Link>
          </div>
        </header>
        {creating && (
          <MenuSettings
            onSave={(input) =>
              mutable.saveCard({
                ...input,
                position: Math.max(-1, ...(menus.data?.map(({ position }) => position) ?? [])) + 1,
              })
            }
            onCancel={() => setCreating(false)}
          />
        )}
        {(menus.isError || categories.isError) && (
          <div role="alert">
            <p>{copy("Could not load menus.")}</p>
            <button
              type="button"
              className={outlineButton}
              onClick={() => {
                void menus.refetch();
                void categories.refetch();
              }}
            >
              {copy("Retry")}
            </button>
          </div>
        )}
        {(menus.isPending || categories.isPending) && (
          <output className="block text-muted-foreground">{copy("Loading menus…")}</output>
        )}
        {menus.data?.length === 0 && (
          <p className="text-muted-foreground">
            {copy("Create a menu, then add its categories and dishes.")}
          </p>
        )}
        {menus.data &&
          categories.data &&
          menus.data.map((menu, index) => (
            <MenuWorkspaceSection
              key={menu.id}
              menu={menu}
              menus={menus.data}
              categories={categories.data}
              immediate={index === 0 || initialMenuId === menu.id}
            />
          ))}
        {menus.data && categories.data && (unassigned.length > 0 || showUnassigned) && (
          <details
            className="border-t border-border pt-4"
            onToggle={(event) => setShowUnassigned(event.currentTarget.open)}
          >
            <summary className="min-h-11 cursor-pointer text-lg font-semibold">
              {copy("Unassigned categories")}{" "}
              <span className="text-sm font-normal text-muted-foreground">{unassigned.length}</span>
            </summary>
            {dishes.isPending ? (
              <output>{copy("Loading dishes…")}</output>
            ) : dishes.isError ? (
              <button className={outlineButton} onClick={() => void dishes.refetch()}>
                {copy("Retry")}
              </button>
            ) : (
              <ul className="divide-y divide-border">
                {unassigned.map((category) => {
                  const members =
                    dishes.data?.filter((dish) => dish.categoryId === category.id) ?? [];
                  return (
                    <li key={category.id} className="flex items-center justify-between gap-4 py-3">
                      <span>{categoryName(category, locale, baseLocale)}</span>
                      {members.length > 0 &&
                        (props.unassignedDishHref ? (
                          <ul className="space-y-1 text-right text-sm">
                            {members.map((dish) => (
                              <li key={dish.id}>
                                <Link
                                  href={props.unassignedDishHref!(dish.id)}
                                  className="underline underline-offset-4"
                                >
                                  {localized(dish.translations, locale, baseLocale).name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {members.length} {copy("dishes")}
                          </span>
                        ))}
                      <IconTooltip
                        label={`${copy("Delete category")} · ${categoryName(category, locale, baseLocale)}`}
                      >
                        <button
                          type="button"
                          className={cn(iconButton, "text-destructive hover:text-destructive")}
                          aria-label={`${copy("Delete category")} · ${categoryName(category, locale, baseLocale)}`}
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </button>
                      </IconTooltip>
                    </li>
                  );
                })}
              </ul>
            )}
          </details>
        )}
        {loaded && <UnassignedDishes categories={categories.data!} />}
      </div>
    </Workspace.Provider>
  );
}

function DeleteCategoryDialog({
  category,
  menuId,
  onClose,
}: {
  category: MenuCategory;
  menuId?: string;
  onClose: () => void;
}) {
  const { client, copy, locale, baseLocale } = useWorkspace();
  const [deleteItems, setDeleteItems] = useState(false);
  const mutation = useMutationAction(client);
  const snapshot = useQuery({
    queryKey: [...workspaceKey, "category-deletion", category.id, menuId],
    queryFn: async () => {
      const [items, menus] = await Promise.all([client.list(), client.listCards()]);
      const menu = menuId ? menus.find(({ id }) => id === menuId) : undefined;
      if (
        (menuId && (!menu || !menu.categoryIds.includes(category.id))) ||
        menus.some((entry) => entry.id !== menuId && entry.categoryIds.includes(category.id)) ||
        menu?.kind === "weekly"
      )
        throw new Error("Category ownership changed.");
      return { menu, items: items.filter((item) => item.categoryId === category.id) };
    },
    refetchOnWindowFocus: false,
  });
  const count = snapshot.data?.items.length ?? 0;
  useMenuDraftGuard(false, mutation.pending);
  return (
    <MenuConfirmation
      open
      title={`${copy("Delete category")} · ${categoryName(category, locale, baseLocale)}`}
      description={
        count
          ? copy(
              deleteItems
                ? "The category and its {count} dishes will be deleted permanently."
                : "The {count} dishes will be kept in Unassigned dishes and hidden from all menus.",
            ).replace("{count}", String(count))
          : copy("This cannot be undone.")
      }
      confirm={copy(deleteItems ? "Delete category and dishes" : "Delete category")}
      cancel={copy("Cancel")}
      destructive
      pending={mutation.pending}
      confirmDisabled={!snapshot.isSuccess || snapshot.isFetching}
      error={
        snapshot.isError || mutation.error
          ? copy(
              "Could not delete. Refresh if the content changed. Remove dish photos and files before deleting the dishes.",
            )
          : undefined
      }
      onCancel={onClose}
      onConfirm={() => {
        if (!snapshot.isSuccess || snapshot.isFetching) return;
        const { menu, items } = snapshot.data;
        void mutation.run(
          () =>
            client.removeCategory(category.id, menu && { id: menu.id, version: menu.version }, {
              deleteItems,
              items: items.map(({ id, version }) => ({ id, version })),
            }),
          onClose,
        );
      }}
    >
      {snapshot.isFetching && <output className="block text-sm">{copy("Loading dishes…")}</output>}
      {(snapshot.isError || mutation.error) && (
        <button
          type="button"
          className={outlineButton}
          disabled={mutation.pending || snapshot.isFetching}
          onClick={() => void snapshot.refetch()}
        >
          {copy("Refresh")}
        </button>
      )}
      {count > 0 && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={deleteItems}
            disabled={mutation.pending}
            onChange={(event) => setDeleteItems(event.target.checked)}
          />
          {copy("Also delete the {count} dishes").replace("{count}", String(count))}
        </label>
      )}
    </MenuConfirmation>
  );
}

function UnassignedDishes({ categories }: { categories: MenuCategory[] }) {
  const {
    client,
    copy,
    locale,
    baseLocale,
    unassignedSearch = "",
    onUnassignedSearchChange,
  } = useWorkspace();
  const [open, setOpen] = useState(Boolean(unassignedSearch));
  const items = useQuery({
    queryKey: [...workspaceKey, "unassigned-items"],
    queryFn: async () =>
      (await (client.listUnassigned?.() ?? client.list())).filter(
        (item) => item.categoryId === null,
      ),
    enabled: open,
  });
  const shown =
    items.data?.filter((item) => {
      const { name, description } = localized(item.translations, locale, baseLocale);
      return matchesTableSearch(unassignedSearch, name, description);
    }) ?? [];
  return (
    <details
      open={open || Boolean(unassignedSearch)}
      className="border-t border-border pt-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer text-lg font-semibold">
        {copy("Unassigned dishes")}{" "}
        {items.data && (
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {items.data.length}
          </span>
        )}
      </summary>
      {open && (
        <div className="space-y-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {copy("These dishes are not shown in any menu.")}
            </p>
            {onUnassignedSearchChange && (
              <TableSearch
                label={copy("Search unassigned dishes")}
                value={unassignedSearch}
                onValueChange={onUnassignedSearchChange}
              />
            )}
          </div>
          {items.isError ? (
            <div role="alert" className="space-y-2">
              <p>{copy("Could not load the dishes.")}</p>
              <button className={outlineButton} onClick={() => void items.refetch()}>
                {copy("Retry")}
              </button>
            </div>
          ) : items.isPending ? (
            <output>{copy("Loading dishes…")}</output>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {copy(unassignedSearch ? "No matching dishes." : "No unassigned dishes.")}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {shown.map((dish) => (
                <UnassignedDish key={dish.id} dish={dish} categories={categories} />
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}

function UnassignedDish({ dish, categories }: { dish: MenuItem; categories: MenuCategory[] }) {
  const {
    client,
    copy,
    locale,
    baseLocale,
    unassignedDishHref,
    linkComponent: Link,
  } = useWorkspace();
  const [action, setAction] = useState<{ kind: "assign" | "delete"; dish: MenuItem }>();
  const [categoryId, setCategoryId] = useState("");
  const actionScope = useMemo(() => ({ client, action }), [client, action]);
  const mutation = useMutationAction(actionScope);
  const name = localized(dish.translations, locale, baseLocale).name;
  useMenuDraftGuard(false, mutation.pending);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="min-w-0 font-medium wrap-anywhere">{name}</span>
      <div className="flex items-center gap-2">
        {unassignedDishHref ? (
          <Link
            href={unassignedDishHref(dish.id)}
            className={outlineButton}
            aria-label={`${copy("Choose a category")} · ${name}`}
          >
            {copy("Choose a category")}
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            className={outlineButton}
            onClick={() => setAction({ kind: "assign", dish: structuredClone(dish) })}
          >
            {copy("Choose a category")}
            <ChevronRightIcon aria-hidden="true" />
          </button>
        )}
        <IconTooltip label={`${copy("Delete dish")} · ${name}`}>
          <button
            type="button"
            className={cn(iconButton, "text-destructive hover:text-destructive")}
            aria-label={`${copy("Delete dish")} · ${name}`}
            onClick={() => setAction({ kind: "delete", dish: structuredClone(dish) })}
          >
            <Trash2Icon aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      {action && (
        <MenuConfirmation
          open
          title={`${copy(action.kind === "delete" ? "Delete dish" : "Choose a category")} · ${name}`}
          description={copy(
            action.kind === "delete"
              ? "This cannot be undone."
              : "The dish’s visibility setting is kept in the selected category.",
          )}
          confirm={copy(action.kind === "delete" ? "Delete dish" : "Move dish")}
          cancel={copy("Cancel")}
          destructive={action.kind === "delete"}
          pending={mutation.pending}
          confirmDisabled={action.kind === "assign" && !categoryId}
          error={
            mutation.error
              ? copy(
                  "Could not save. Refresh if the dish changed. Remove its photos and files before deleting it.",
                )
              : undefined
          }
          onCancel={() => setAction(undefined)}
          onConfirm={() =>
            void mutation.run(
              async () => {
                const target = action.dish;
                if (action.kind === "delete")
                  await client.remove(target.id, { categoryId: null, version: target.version });
                else await client.save(target.id, target.version, { ...target, categoryId });
              },
              () => setAction(undefined),
            )
          }
        >
          {action.kind === "assign" && (
            <label className="block space-y-1 text-sm">
              <span>{copy("Category")}</span>
              <NativeSelect
                className={field}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">{copy("Choose a category")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryName(category, locale, baseLocale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </MenuConfirmation>
      )}
    </li>
  );
}

const buttonForCategory =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring";
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const courses = { starter: "Starters", main: "Main courses", dessert: "Desserts" };
const menuKindLabels = {
  standard: "Menu",
  formula: "Set menu",
  weekly: "Weekly menu",
} as const;
const menuKindHelp = {
  standard: "A menu with individual dish prices.",
  formula: "Put the set price in the menu or category description.",
  weekly: "Dishes grouped by day for a set period.",
} as const;
const rootName = (menu: MenuCard, locale: string, baseLocale: string) =>
  localized(menu.translations, locale, baseLocale).name;
const categoryName = (category: MenuCategory, locale: string, baseLocale: string) =>
  localized(category.translations, locale, baseLocale);
const emptyMenu: MenuCardInput = {
  position: 0,
  translations: {},
  categoryIds: [],
  published: false,
  displayMode: "lines",
  startDate: null,
  endDate: null,
  kind: "standard",
  weekdays: [],
  weeklySections: [],
};

const actionMenu =
  "min-w-56 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none [&_[role=menuitem]]:flex [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:cursor-pointer [&_[role=menuitem]]:items-center [&_[role=menuitem]]:gap-2 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:px-3 [&_[role=menuitem][data-disabled]]:cursor-not-allowed [&_[role=menuitem][data-disabled]]:opacity-50 [&_[role=menuitem][data-highlighted]]:bg-accent";

function Actions({
  label,
  children,
  icon = false,
}: {
  label: string;
  children: ReactNode;
  icon?: boolean;
}) {
  const hydrated = useHydrated();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        disabled={!hydrated}
        className={icon ? iconButton : outlineButton}
        aria-label={label}
      >
        {icon ? <MoreHorizontalIcon aria-hidden="true" /> : label}
        {!icon && <ChevronDownIcon aria-hidden="true" className="size-4" />}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Positioner sideOffset={6} align="end" className="z-50">
          <Dropdown.Popup className={actionMenu}>{children}</Dropdown.Popup>
        </Dropdown.Positioner>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function MenuSettings({
  menu,
  onSave,
  onCancel,
  inDialog = false,
  onPendingChange,
}: {
  menu?: MenuCard;
  inDialog?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSave: (input: MenuCardInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { copy, locales, currency, baseLocale } = useWorkspace();
  const [draft, setDraft] = useState(menu ?? emptyMenu);
  const id = `factory-menu-settings-${useId()}`;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onPendingChange?.(pending), [pending, onPendingChange]);
  useMenuDraftGuard(JSON.stringify(draft) !== JSON.stringify(menu ?? emptyMenu), pending);
  return (
    <form
      className="grid gap-4 border-y border-border py-6 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.translations[baseLocale]?.name.trim()) {
          setError(copy("Enter a name in the base language."));
          return;
        }
        setPending(true);
        setError("");
        void onSave({
          ...draft,
          displayMode:
            draft.kind !== "weekly" && draft.displayMode === "photos" ? "photos" : "lines",
        })
          .then(onCancel)
          .catch(() =>
            setError(copy("Could not save. Check the dates and reload if this menu has changed.")),
          )
          .finally(() => setPending(false));
      }}
    >
      <fieldset disabled={pending} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <legend className={inDialog ? "sr-only" : "mb-4 text-lg font-semibold"}>
          {copy(menu ? "Menu settings" : "Create a menu")}
        </legend>
        {!menu && (
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{copy("Menu type")}</legend>
            <div className="flex flex-wrap gap-2">
              {menuKinds.map((kind) => (
                <label
                  key={kind}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={(draft.kind ?? "standard") === kind}
                    aria-describedby={
                      (draft.kind ?? "standard") === kind ? `${id}-kind-help` : undefined
                    }
                    onChange={() =>
                      setDraft({
                        ...draft,
                        kind,
                        weekdays: kind === "weekly" ? [1, 2, 3, 4, 5] : [],
                      })
                    }
                    className="accent-primary"
                  />
                  {copy(menuKindLabels[kind])}
                </label>
              ))}
            </div>
            <p id={`${id}-kind-help`} className="mt-2 text-sm text-muted-foreground">
              {copy(menuKindHelp[draft.kind ?? "standard"])}
            </p>
          </fieldset>
        )}
        <div className="@container sm:col-span-2">
          <div className="grid gap-4 @min-[36rem]:grid-cols-3">
            {locales.map((locale) => (
              <div key={locale.code} className="space-y-3">
                <label className="grid gap-1 text-sm">
                  {copy("Name ·")} {locale.name}
                  <input
                    className={field}

                    required={locale.code === baseLocale}
                    maxLength={200}
                    value={draft.translations[locale.code]?.name ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        translations: {
                          ...draft.translations,
                          [locale.code]: {
                            name: event.target.value,
                            description: draft.translations[locale.code]?.description ?? "",
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  {copy("Description ·")} {locale.name}
                  <textarea
                    className={field}
                    rows={2}
                    maxLength={2000}
                    value={draft.translations[locale.code]?.description ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        translations: {
                          ...draft.translations,
                          [locale.code]: {
                            name: draft.translations[locale.code]?.name ?? "",
                            description: event.target.value,
                          },
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
        {draft.kind !== "weekly" && (
          <div className="grid content-start gap-1 text-sm">
            <label htmlFor={`${id}-display`}>{copy("Display")}</label>
            <NativeSelect
              className={field}
              id={`${id}-display`}
              value={draft.displayMode === "photos" ? "photos" : "lines"}
              onChange={(event) =>
                setDraft({ ...draft, displayMode: event.target.value as MenuCard["displayMode"] })
              }
            >
              <option value="lines">{copy("Lines without photos")}</option>
              <option value="photos">{copy("Lines with photos")}</option>
            </NativeSelect>
          </div>
        )}
        <label className="grid content-start gap-1 text-sm">
          {copy("Currency label")}
          <input
            className={field}
            required
            maxLength={16}
            value={draft.currencyLabel ?? currency}
            onChange={(event) => setDraft({ ...draft, currencyLabel: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            {copy("Changes the displayed currency label without converting amounts.")}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            {copy("From")}
            <input
              type="date"
              className={field}
              required={draft.kind === "weekly"}
              value={draft.startDate ?? ""}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value || null })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {copy("To")}
            <input
              type="date"
              className={field}
              required={draft.kind === "weekly"}
              min={draft.startDate ?? undefined}
              value={draft.endDate ?? ""}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })}
            />
          </label>
        </div>
        {draft.kind === "weekly" && (
          <fieldset className="flex flex-wrap gap-3 sm:col-span-2">
            <legend className="mb-2 text-sm">{copy("Days shown")}</legend>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <label key={day} className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={(draft.weekdays ?? []).includes(day)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      weekdays: event.target.checked
                        ? [...(draft.weekdays ?? []), day]
                        : (draft.weekdays ?? []).filter((value) => value !== day),
                    })
                  }
                />
                {copy(days[day])}
              </label>
            ))}
          </fieldset>
        )}
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {copy("A new menu stays unpublished until you publish it.")}
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={primary} disabled={pending}>
          {pending ? copy("Saving…") : copy("Save")}
        </button>
        <button type="button" className={outlineButton} disabled={pending} onClick={onCancel}>
          {copy("Cancel")}
        </button>
      </div>
    </form>
  );
}

function CategoryForm({
  category,
  onSave,
  onCancel,
}: {
  category?: MenuCategory;
  onSave: (
    input: Omit<MenuCategory, "id" | "version"> & { id?: string; version?: number },
  ) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { copy, locales, baseLocale } = useWorkspace();
  const [draft, setDraft] = useState<
    Omit<MenuCategory, "id" | "version"> & { id?: string; version?: number }
  >(category ?? { position: 0, translations: { [baseLocale]: "" }, descriptions: {} });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useMenuDraftGuard(
    JSON.stringify(draft) !==
      JSON.stringify(
        category ?? { position: 0, translations: { [baseLocale]: "" }, descriptions: {} },
      ),
    pending,
  );
  return (
    <form
      className="my-4 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(false);
        void onSave(draft)
          .then(onCancel)
          .catch(() => setError(true))
          .finally(() => setPending(false));
      }}
    >
      {locales.map((locale) => (
        <div className="space-y-3" key={locale.code}>
          <label className="grid gap-1 text-sm">
            {copy("Name ·")} {locale.name}
            <input
              disabled={pending}
              className={field}
              required={locale.code === baseLocale}
              maxLength={120}
              value={draft.translations[locale.code] ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  translations: { ...draft.translations, [locale.code]: event.target.value },
                })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            {copy("Description ·")} {locale.name}
            <textarea
              disabled={pending}
              className={field}
              rows={2}
              maxLength={2000}
              value={draft.descriptions?.[locale.code] ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  descriptions: { ...draft.descriptions, [locale.code]: event.target.value },
                })
              }
            />
          </label>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {copy("Could not save. Reload if the category has changed.")}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-3">
        <button className={primary} disabled={pending}>
          {copy("Save")}
        </button>
        <button type="button" className={outlineButton} disabled={pending} onClick={onCancel}>
          {copy("Cancel")}
        </button>
      </div>
    </form>
  );
}

function MenuWorkspaceSection({
  menu,
  menus,
  categories,
  immediate,
}: {
  menu: MenuCard;
  menus: MenuCard[];
  categories: MenuCategory[];
  immediate: boolean;
}) {
  const {
    copy,
    client,
    locale,
    baseLocale,
    currency,
    today,
    previewHref,
    dishHref,
    staffKey,
    search,
    onSearchChange,
    initialSettingsMenuId,
    linkComponent: Link,
  } = useWorkspace();
  const [sharedCategory, setSharedCategory] = useState<string>();
  const notify = useActionToast();
  const section = useRef<HTMLElement>(null);
  const hydrated = useHydrated();
  const [near, setNear] = useState(immediate);
  const [settings, setSettings] = useState(initialSettingsMenuId === menu.id);
  const [settingsPending, setSettingsPending] = useState(false);
  const settingsOpen = settings;
  function closeSettings() {
    setSettings(false);
  }
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [adding, setAdding] = useState<"new" | "existing" | null>(null);
  const [existing, setExisting] = useState("");
  const [editing, setEditing] = useState<string>();
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    label: string;
    destructive?: boolean;
    rememberVisibility?: boolean;
    execute: () => Promise<unknown>;
  } | null>(null);
  const [rememberVisibility, setRememberVisibility] = useState(false);
  const visibilityPreference = staffKey && `forge:menus:skip-visibility-confirmation:${staffKey}`;
  const copyRequest = useRef<string | null>(null);
  const items = useQuery({
    queryKey: [...workspaceKey, "items", menu.id],
    queryFn: () => client.listItems(menu.id),
    enabled: immediate || near,
  });
  const money = menuPriceFormatter(locale, currency);
  const activeCategories = visibleMenuCategoryIds(menu);
  const searchValue = search?.menuId === menu.id ? search.value : "";
  const searching = Boolean(searchValue.trim());
  const reservedCategories = new Set(
    menus.flatMap((entry) => entry.weeklySections?.map((section) => section.categoryId) ?? []),
  );
  useEffect(() => {
    if (immediate || near || !section.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [immediate, near]);
  async function run(work: () => Promise<unknown>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await work();
      notify(copy("Saved."));
      return true;
    } catch {
      setError(copy("Could not save. Reload if a colleague has changed this menu."));
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  function changeOrder(id: string, target: string, after = false) {
    void run(() =>
      client.saveCard({ ...menu, categoryIds: moveMenuEntry(menu.categoryIds, id, target, after) }),
    );
  }
  function placeDish(id: string, categoryId: string, beforeId?: string) {
    const item = items.data?.find((value) => value.id === id);
    if (!item || item.categoryId === null || !items.data || id === beforeId) return;
    const affected = [...new Set([item.categoryId, categoryId])];
    if (
      affected.some(
        (id) =>
          id !== sharedCategory &&
          menus.filter((value) => value.categoryIds.includes(id)).length > 1,
      )
    )
      return;
    const groups = affected.map((id) => ({
      categoryId: id,
      items: items.data
        .filter((value) => value.categoryId === id && value.id !== item.id)
        .sort((a, b) => a.position - b.position)
        .map(({ id, version }) => ({ id, version })),
    }));
    const destination = groups.find((group) => group.categoryId === categoryId);
    if (!destination) return;
    const before = destination.items.findIndex((value) => value.id === beforeId);
    destination.items.splice(before < 0 ? destination.items.length : before, 0, {
      id: item.id,
      version: item.version,
    });
    void run(() => client.placeItems(groups));
  }
  const drag = useMenuDrag(
    activeCategories,
    items.data ?? [],
    (id) =>
      menus.filter((menu) => menu.categoryIds.includes(id)).length <= 1 || sharedCategory === id,
    (ids) =>
      run(() =>
        client.saveCard({
          ...menu,
          categoryIds: [...ids, ...menu.categoryIds.filter((id) => !activeCategories.includes(id))],
        }),
      ),
    (groups) => run(() => client.placeItems(groups)),
  );
  const status = menuCardStatus(menu, today);
  const stateText = {
    unpublished: copy("Unpublished"),
    scheduled: copy("Scheduled"),
    live: copy("Live"),
    ended: copy("Ended"),
  }[status];
  return (
    <section
      ref={section}
      id={`factory-menu-${menu.id}`}
      data-menu-workspace-section
      className="min-h-48 scroll-mt-[calc(var(--menu-workspace-top,0px)+1rem)] pb-8"
      aria-label={rootName(menu, locale, baseLocale)}
    >
      {deletingCategory && (
        <DeleteCategoryDialog
          category={deletingCategory}
          menuId={menu.id}
          onClose={() => setDeletingCategory(undefined)}
        />
      )}
      <header className="sticky top-[var(--menu-workspace-top,0px)] z-20 -mx-1 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-1 py-4">
        <h2 className="min-w-0 font-serif text-2xl font-semibold wrap-anywhere">
          {rootName(menu, locale, baseLocale)}
        </h2>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {onSearchChange && (
            <TableSearch
              label={copy("Search dishes")}
              value={searchValue}
              maxLength={100}
              onValueChange={(value) => onSearchChange(menu.id, value)}
            />
          )}
          <Link href={previewHref(menu.id)} className={outlineButton}>
            <EyeIcon aria-hidden="true" className="size-4" />
            {copy("Preview")}
          </Link>
          <button
            className={outlineButton}
            disabled={!hydrated || pending}
            onClick={() => setSettings((value) => !value)}
            aria-expanded={settingsOpen}
          >
            <SettingsIcon aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">{copy("Settings")}</span>
          </button>
          {menu.kind !== "weekly" && (
            <Actions label={copy("+ Category")}>
              <Dropdown.Item onClick={() => setAdding("new")}>
                {copy("Create a category")}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setAdding("existing")}>
                {copy("Add an existing category")}
              </Dropdown.Item>
            </Actions>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={menu.published}
            title={stateText}
            aria-label={`${copy("Menu publication")} ${rootName(menu, locale, baseLocale)}`}
            disabled={pending || !hydrated}
            onClick={() => {
              setError("");
              setConfirmation({
                title: menu.published ? copy("Unpublish this menu?") : copy("Publish this menu?"),
                description: menu.published
                  ? copy("This menu will no longer be visible on the website.")
                  : copy("Visible dishes will appear on the website during the selected period."),
                label: menu.published ? copy("Unpublish") : copy("Publish"),
                execute: () => client.saveCard({ ...menu, published: !menu.published }),
              });
            }}
            className={cn(
              outlineButton,
              "min-h-11",
              menu.published &&
                "border-status-success bg-status-success text-status-success-foreground",
            )}
          >
            <span
              className={cn(
                "relative h-5 w-8 rounded-full border border-current",
                menu.published && "bg-status-success-foreground/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-current transition-transform motion-reduce:transition-none",
                  menu.published && "translate-x-3",
                )}
              />
            </span>
            {menu.published ? copy("Published") : copy("Unpublished")}
          </button>
        </div>
      </header>
      {(menu.startDate || menu.endDate) && (
        <p className="mb-3 text-sm text-muted-foreground tabular-nums">
          {menu.startDate ?? ""} – {menu.endDate ?? ""}
        </p>
      )}
      {localized(menu.translations, locale, baseLocale).description && (
        <p className="mb-6 max-w-prose whitespace-pre-wrap text-muted-foreground">
          {localized(menu.translations, locale, baseLocale).description}
        </p>
      )}
      {items.data?.some((dish) => dish.priceMinor !== null) && (
        <p className="mb-3 text-right text-sm text-muted-foreground">
          {copy("Price")} ({menu.currencyLabel ?? currency})
        </p>
      )}
      <Dialog.Root
        open={settingsOpen}
        onOpenChange={(value) => {
          if (!value && !settingsPending) closeSettings();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(52rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
            <div className="sticky -top-6 z-10 -mx-6 flex items-center justify-between gap-3 border-b border-border bg-popover px-6 py-3">
              <Dialog.Title className="text-xl font-semibold">
                {copy("Menu settings")} · {rootName(menu, locale, baseLocale)}
              </Dialog.Title>
              <Dialog.Close
                disabled={settingsPending}
                className={iconButton}
                aria-label={copy("Close")}
              >
                <XIcon aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              {copy("Menu name, translations, display and dates.")}
            </Dialog.Description>
            <MenuSettings
              inDialog
              onPendingChange={setSettingsPending}
              menu={menu}
              onSave={(input) => client.saveCard(input)}
              onCancel={closeSettings}
            />
            <div className="mt-4 flex justify-end">
              <DeleteControl
                disabled={settingsPending}
                label={copy("Delete this menu")}
                confirm={copy("Delete this menu? Its categories and dishes are kept.")}
                cancel={copy("Cancel")}
                errorMessage={copy("Could not delete this menu.")}
                onDelete={() => client.removeCard(menu.id, menu.version)}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <MenuConfirmation
        open={!!confirmation}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirm={confirmation?.label ?? ""}
        destructive={confirmation?.destructive}
        cancel={copy("Cancel")}
        pending={pending}
        error={error}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation)
            void run(confirmation.execute).then((success) => {
              if (!success) return;
              if (visibilityPreference && confirmation.rememberVisibility && rememberVisibility) {
                try {
                  window.localStorage.setItem(visibilityPreference, "true");
                } catch {
                  // The visibility update still succeeds if browser storage is unavailable.
                }
              }
              setConfirmation(null);
            });
        }}
      >
        {confirmation?.rememberVisibility && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rememberVisibility}
              disabled={pending}
              className="accent-primary"
              onChange={(event) => setRememberVisibility(event.target.checked)}
            />
            {copy("Don’t remind me again")}
          </label>
        )}
      </MenuConfirmation>
      {error && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {adding === "new" && (
        <CategoryForm
          onCancel={() => setAdding(null)}
          onSave={(input) =>
            client.saveCategory({ ...input, menu: { id: menu.id, version: menu.version } })
          }
        />
      )}
      {adding === "existing" && (
        <form
          className="my-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await client.saveCard({ ...menu, categoryIds: [...menu.categoryIds, existing] });
              setAdding(null);
            });
          }}
        >
          <label className="grid min-w-0 flex-1 gap-2 text-sm">
            {copy("Existing category")}
            <NativeSelect
              className={field}
              required
              value={existing}
              onChange={(event) => setExisting(event.target.value)}
            >
              <option value="">{copy("Choose a category")}</option>
              {categories
                .filter(
                  (category) =>
                    !menu.categoryIds.includes(category.id) && !reservedCategories.has(category.id),
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryName(category, locale, baseLocale)}
                  </option>
                ))}
            </NativeSelect>
          </label>
          <button className={primary} disabled={pending || !existing}>
            {copy("Add")}
          </button>
          <button type="button" className={outlineButton} onClick={() => setAdding(null)}>
            {copy("Cancel")}
          </button>
        </form>
      )}
      {items.isError && (
        <div role="alert" className="space-y-2">
          <p>{copy("Could not load the dishes.")}</p>
          <button className={outlineButton} onClick={() => void items.refetch()}>
            {copy("Retry")}
          </button>
        </div>
      )}
      {menu.categoryIds.length === 0 && (
        <p className="py-6 text-muted-foreground">{copy("Add a category to get started.")}</p>
      )}
      <div className="flex flex-col gap-5">
        {activeCategories.map((id, categoryIndex) => {
          const category = categories.find((value) => value.id === id);
          if (!category) return null;
          const uses = menus.filter((value) => value.categoryIds.includes(id));
          const shared = uses.length > 1;
          const locked = shared && sharedCategory !== id;
          const categoryDishes = items.data?.filter((item) => item.categoryId === id) ?? [];
          const dishes = searching
            ? categoryDishes.filter((dish) => {
                const text = localized(dish.translations, locale, baseLocale);
                return matchesTableSearch(
                  searchValue,
                  text.name,
                  text.description,
                  categoryName(category, locale, baseLocale),
                );
              })
            : categoryDishes;
          const weekly = (menu.weeklySections ?? []).find((value) => value.categoryId === id);
          return (
            <motion.div
              key={id}
              layout={reducedMotion ? false : "position"}
              transition={{ layout: { duration: 0.18 } }}
              data-menu-category={id}
              style={{ order: drag.categories.indexOf(id) }}
              data-menu-drag-placeholder={
                (drag.session?.kind === "category" && drag.session.id === id) || undefined
              }
              className={cn(
                drag.session?.kind === "category" && drag.session.id === id && "opacity-30",
              )}
            >
              <section
                aria-label={categoryName(category, locale, baseLocale)}
                className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}
                    aria-label={`${copy("Move category")} ${categoryName(category, locale, baseLocale)}`}
                    disabled={pending || searching}
                    {...drag.handle("category", id)}
                  >
                    <GripVerticalIcon aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    className={cn(buttonForCategory, "min-w-[calc(100%-3rem)] flex-1 sm:min-w-0")}
                    aria-expanded={!collapsed.includes(id)}
                    onClick={() =>
                      setCollapsed((value) =>
                        value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id],
                      )
                    }
                  >
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 transition-transform",
                        collapsed.includes(id) && "-rotate-90",
                      )}
                    />
                    <span className="min-w-0 text-left font-semibold wrap-anywhere">
                      {weekly
                        ? `${copy(days[weekly.day])} · ${copy(courses[weekly.course])}`
                        : categoryName(category, locale, baseLocale)}{" "}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {items.data ? dishes.length : "…"}
                      </span>
                    </span>
                  </button>
                  {shared && (
                    <details className="relative">
                      <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-md bg-muted px-2 text-xs">
                        <LinkIcon aria-hidden="true" className="size-3" />
                        {copy("Shared by")} {uses.length} {copy("menus")}
                      </summary>
                      <div className="absolute right-0 z-30 mt-2 min-w-52 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md">
                        {uses.map((value) => (
                          <p key={value.id}>{rootName(value, locale, baseLocale)}</p>
                        ))}
                      </div>
                    </details>
                  )}
                  {!locked && (
                    <Link
                      href={dishHref(menu.id, undefined, id)}
                      className={cn(outlineButton, "ml-auto sm:ml-0")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <PlusIcon aria-hidden="true" className="size-4" />
                      {copy("Dish")}
                    </Link>
                  )}
                  <Actions
                    label={`${copy("Actions for")} ${categoryName(category, locale, baseLocale)}`}
                    icon
                  >
                    <Dropdown.Item
                      disabled={categoryIndex === 0 || pending || searching}
                      onClick={() => changeOrder(id, activeCategories[categoryIndex - 1])}
                    >
                      <ArrowUpIcon className="size-4" aria-hidden="true" />
                      {copy("Move up")}
                    </Dropdown.Item>
                    <Dropdown.Item
                      disabled={
                        categoryIndex === activeCategories.length - 1 || pending || searching
                      }
                      onClick={() => changeOrder(id, activeCategories[categoryIndex + 1], true)}
                    >
                      <ArrowDownIcon className="size-4" aria-hidden="true" />
                      {copy("Move down")}
                    </Dropdown.Item>
                    <Dropdown.Item disabled={locked} onClick={() => setEditing(id)}>
                      <PencilIcon aria-hidden="true" className="size-4" />
                      {copy("Edit category")}
                    </Dropdown.Item>
                    <Dropdown.Item
                      disabled={menu.kind === "weekly"}
                      onClick={() => {
                        setError("");
                        setConfirmation({
                          title: copy("Remove this category from the menu?"),
                          description: copy(
                            "The category and its dishes are kept. Other menus stay unchanged.",
                          ),
                          label: copy("Remove"),
                          execute: () =>
                            client.saveCard({
                              ...menu,
                              categoryIds: menu.categoryIds.filter((value) => value !== id),
                              weeklySections: (menu.weeklySections ?? []).filter(
                                (value) => value.categoryId !== id,
                              ),
                            }),
                        });
                      }}
                    >
                      <UnlinkIcon aria-hidden="true" className="size-4" />
                      {copy("Remove from this menu")}
                    </Dropdown.Item>
                    {!shared && menu.kind !== "weekly" && (
                      <>
                        <Dropdown.Separator className="my-1 border-t border-border" />
                        <Dropdown.Item
                          className="text-destructive"
                          disabled={pending || !items.isSuccess}
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2Icon aria-hidden="true" className="size-4" />
                          {copy("Delete category")}
                        </Dropdown.Item>
                      </>
                    )}
                  </Actions>
                </div>
                <div hidden={!searching && collapsed.includes(id)}>
                  {localized(category.descriptions ?? {}, locale, baseLocale) && (
                    <p className="mt-3 max-w-prose text-sm whitespace-pre-wrap text-muted-foreground">
                      {localized(category.descriptions ?? {}, locale, baseLocale)}
                    </p>
                  )}
                  {sharedCategory === id && (
                    <p className="my-4 rounded-lg bg-muted p-3 text-sm">
                      {copy("Changes apply to")}{" "}
                      {uses.map((value) => rootName(value, locale, baseLocale)).join(", ")}.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(undefined);
                          setSharedCategory(undefined);
                        }}
                        className="cursor-pointer underline underline-offset-4"
                      >
                        {copy("Finish editing shared content")}
                      </button>
                    </p>
                  )}
                  {editing === id && (
                    <CategoryForm
                      category={category}
                      onCancel={() => setEditing(undefined)}
                      onSave={(input) => client.saveCategory(input)}
                    />
                  )}
                  <div className="relative mt-4 flex flex-col border-l border-border pl-3 sm:pl-5">
                    {items.isPending ? (
                      <output className="block py-5 text-sm text-muted-foreground">
                        {copy("Loading dishes…")}
                      </output>
                    ) : dishes.length === 0 ? (
                      <p className="py-5 text-sm text-muted-foreground">
                        {copy(searching ? "No matching dishes." : "No dishes in this category.")}
                      </p>
                    ) : (
                      dishes.map((dish, index) => (
                        <motion.div
                          key={dish.id}
                          layout={reducedMotion ? false : "position"}
                          transition={{ layout: { duration: 0.18 } }}
                          data-menu-dish={dish.id}
                          style={{ order: drag.session?.groups[id].indexOf(dish.id) ?? index }}
                          data-menu-drag-placeholder={
                            (drag.session?.kind === "dish" && drag.session.id === dish.id) ||
                            undefined
                          }
                          className={cn(
                            "flex min-h-16 flex-wrap items-center gap-2 border-t border-border py-3",
                            drag.session?.kind === "dish" &&
                              drag.session.id === dish.id &&
                              (drag.session.groups[id].includes(dish.id)
                                ? "opacity-30"
                                : "pointer-events-none absolute opacity-0"),
                          )}
                        >
                          <button
                            className={cn(
                              iconButton,
                              "cursor-grab touch-none active:cursor-grabbing",
                            )}
                            disabled={locked || pending || searching}
                            aria-label={`${copy("Move")} ${localized(dish.translations, locale, baseLocale).name}`}
                            {...drag.handle("dish", dish.id)}
                          >
                            <GripVerticalIcon aria-hidden="true" className="size-4" />
                          </button>
                          <span className="min-w-24 flex-1 wrap-anywhere">
                            {localized(dish.translations, locale, baseLocale).name}
                          </span>
                          <span className="ml-auto text-sm tabular-nums">
                            {dish.priceMinor === null ? "" : money(dish.priceMinor)}
                          </span>
                          <button
                            type="button"
                            aria-label={`${copy("Dish visibility")} · ${localized(dish.translations, locale, baseLocale).name}`}
                            aria-pressed={dish.visible}
                            disabled={!hydrated || locked || pending}
                            className={cn(
                              outlineButton,
                              "min-h-8 gap-1.5 px-2 text-xs [&_svg]:size-3.5",
                              dish.visible &&
                                "border-status-success-foreground/30 bg-status-success text-status-success-foreground hover:bg-status-success/65 hover:text-status-success-foreground",
                            )}
                            onClick={() => {
                              const saveVisibility = () =>
                                client.save(dish.id, dish.version, {
                                  ...dish,
                                  visible: !dish.visible,
                                });
                              if (!shared && visibilityPreference) {
                                try {
                                  if (
                                    window.localStorage.getItem(visibilityPreference) === "true"
                                  ) {
                                    void run(saveVisibility);
                                    return;
                                  }
                                } catch {
                                  // Confirmation remains available without browser storage.
                                }
                              }
                              setError("");
                              setRememberVisibility(false);
                              setConfirmation({
                                title: dish.visible
                                  ? copy("Hide this dish?")
                                  : copy("Show this dish?"),
                                description: shared
                                  ? copy("This change applies to every menu using this category.")
                                  : copy("This change applies to this menu."),
                                label: dish.visible
                                  ? copy("Stop showing")
                                  : copy("Show on this menu"),
                                rememberVisibility: !shared && !!visibilityPreference,
                                execute: saveVisibility,
                              });
                            }}
                          >
                            {dish.visible ? (
                              <EyeIcon aria-hidden="true" />
                            ) : (
                              <EyeOffIcon aria-hidden="true" />
                            )}
                            {dish.visible ? copy("Shown") : copy("Not shown")}
                          </button>
                          <Actions
                            label={`${copy("Dish actions")} ${localized(dish.translations, locale, baseLocale).name}`}
                            icon
                          >
                            <Dropdown.Item
                              disabled={locked || pending}
                              render={<Link href={dishHref(menu.id, dish.id)} />}
                            >
                              <PencilIcon aria-hidden="true" className="size-4" />
                              {copy("Edit dish")}
                            </Dropdown.Item>
                            <Dropdown.SubmenuRoot>
                              <Dropdown.SubmenuTrigger disabled={locked || pending || searching}>
                                <MoveIcon aria-hidden="true" className="size-4" />
                                {copy("Move")}
                                <ChevronRightIcon aria-hidden="true" className="ml-auto size-4" />
                              </Dropdown.SubmenuTrigger>
                              <Dropdown.Portal>
                                <Dropdown.Positioner side="right" sideOffset={6} className="z-50">
                                  <Dropdown.Popup
                                    className={cn(
                                      actionMenu,
                                      "max-h-[var(--available-height)] max-w-72 overflow-auto",
                                    )}
                                  >
                                    <Dropdown.Item
                                      disabled={pending || index === 0}
                                      onClick={() => placeDish(dish.id, id, dishes[index - 1]?.id)}
                                    >
                                      <ArrowUpIcon aria-hidden="true" className="size-4" />
                                      {copy("Move up")}
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                      disabled={pending || index === dishes.length - 1}
                                      onClick={() => placeDish(dish.id, id, dishes[index + 2]?.id)}
                                    >
                                      <ArrowDownIcon aria-hidden="true" className="size-4" />
                                      {copy("Move down")}
                                    </Dropdown.Item>
                                    {categories
                                      .filter(
                                        (value) =>
                                          activeCategories.includes(value.id) &&
                                          value.id !== id &&
                                          menus.filter((root) =>
                                            root.categoryIds.includes(value.id),
                                          ).length === 1,
                                      )
                                      .map((value) => (
                                        <Dropdown.Item
                                          key={value.id}
                                          disabled={pending}
                                          onClick={() => placeDish(dish.id, value.id)}
                                        >
                                          {categoryName(value, locale, baseLocale)}
                                        </Dropdown.Item>
                                      ))}
                                  </Dropdown.Popup>
                                </Dropdown.Positioner>
                              </Dropdown.Portal>
                            </Dropdown.SubmenuRoot>
                            <Dropdown.Item
                              disabled={locked || pending}
                              onClick={() => {
                                setError("");
                                setConfirmation({
                                  title: copy("Delete this dish?"),
                                  description: copy("This cannot be undone."),
                                  label: copy("Delete dish"),
                                  execute: () => client.remove(dish.id),
                                });
                              }}
                            >
                              <Trash2Icon aria-hidden="true" className="size-4" />
                              {copy("Delete dish")}
                            </Dropdown.Item>
                          </Actions>
                        </motion.div>
                      ))
                    )}
                    {drag.session?.kind === "dish" &&
                      drag.session.groups[id].includes(drag.session.id) &&
                      !dishes.some((dish) => dish.id === drag.session?.id) && (
                        <div
                          data-menu-drag-placeholder
                          style={{ order: drag.session.groups[id].indexOf(drag.session.id) }}
                          className="flex min-h-16 items-center gap-3 border-t border-border py-3 opacity-30"
                        >
                          <GripVerticalIcon aria-hidden="true" className="size-4" />
                          <span>
                            {
                              localized(
                                items.data!.find((dish) => dish.id === drag.session?.id)!
                                  .translations,
                                locale,
                                baseLocale,
                              ).name
                            }
                          </span>
                        </div>
                      )}
                  </div>
                  {locked && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                      <p className="text-muted-foreground">
                        {copy("Shared content. Changes apply everywhere it is used.")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSharedCategory(id)}
                        className={outlineButton}
                      >
                        {copy("Edit shared category")}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          );
        })}
      </div>
      {drag.session &&
        createPortal(
          <div
            data-menu-drag-preview
            className="pointer-events-none fixed z-40 flex max-w-72 items-center gap-2 rounded-lg border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-md"
            style={{ left: drag.session.x + 12, top: drag.session.y + 12 }}
          >
            <GripVerticalIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              {drag.session.kind === "category"
                ? categoryName(
                    categories.find((category) => category.id === drag.session?.id)!,
                    locale,
                    baseLocale,
                  )
                : localized(
                    items.data!.find((item) => item.id === drag.session?.id)!.translations,
                    locale,
                    baseLocale,
                  ).name}
            </span>
          </div>,
          document.body,
        )}
      {menu.kind === "weekly" && (
        <div className="mt-5 space-y-2">
          <button
            className={outlineButton}
            disabled={pending}
            onClick={() =>
              void run(async () => {
                copyRequest.current ??= crypto.randomUUID();
                await client.nextWeek(menu.id, menu.version, copyRequest.current);
                copyRequest.current = null;
              })
            }
          >
            {copy("Create next week’s menu")}
          </button>
          <p className="text-xs text-muted-foreground">
            {copy("Copies the structure without dishes. The new menu stays unpublished.")}
          </p>
        </div>
      )}
    </section>
  );
}
