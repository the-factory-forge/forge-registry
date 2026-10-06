"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import {
  ArrowLeftIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { DriveBrowser, type DriveClient, type DriveEntry } from "@/components/plugins/drive";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import { MenuLabelBadge, MenuLabelSymbol } from "@/components/plugins/menus/label-badge";
import { menuLabelIcons, type MenuLabelIcon } from "@/components/plugins/menus/label-presets";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import { parsePrice } from "@/components/plugins/menus/model";
import { MenuSpiceBadge } from "@/components/plugins/menus/spice-badge";
import type {
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
} from "@/components/plugins/menus/types";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";

const field =
  "min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
const outlineButton = cn(button, "border border-border");
const primary = cn(
  button,
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
);
const page = "mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-foreground";
const iconButton = cn(button, "size-8 min-h-8 shrink-0 p-0");
const editorLocales = (locales: readonly { code: string; name: string }[], baseLocale: string) =>
  locales.some((locale) => locale.code === baseLocale)
    ? locales
    : [{ code: baseLocale, name: baseLocale }, ...locales];

function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function DeleteControl({
  label,
  confirm,
  cancel,
  errorMessage,
  onDelete,
  onDone,
}: {
  label: string;
  confirm: string;
  cancel: string;
  errorMessage: string;
  onDelete: () => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <Dialog.Trigger
        className={cn(iconButton, "text-destructive hover:text-destructive")}
        aria-label={label}
      >
        <Trash2Icon aria-hidden="true" className="size-4 shrink-0" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{label}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {confirm}?
          </Dialog.Description>
          {error ? <ErrorMessage message={errorMessage} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Close className={outlineButton} disabled={pending}>
              {cancel}
            </Dialog.Close>
            <button
              type="button"
              className={cn(
                primary,
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
              )}
              disabled={pending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                setPending(true);
                setError(false);
                void onDelete()
                  .then(() => {
                    setOpen(false);
                    onDone();
                  })
                  .catch(() => setError(true))
                  .finally(() => {
                    lock.current = false;
                    setPending(false);
                  });
              }}
            >
              {confirm}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface MenuItemsPageProps {
  client: MenusClient;
  baseLocale: string;
  newHref: string;
  taxonomyHref: string;
  getEditHref: (item: MenuItem) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuItemsPage({
  client,
  baseLocale,
  newHref,
  taxonomyHref,
  getEditHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuItemsPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ items: MenuItem[]; categories: MenuCategory[] }>();
  const [error, setError] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<"saved" | "error">();
  const [dragTarget, setDragTarget] = useState<string>();
  const drag = useRef<{ id: string; targetId: string } | undefined>(undefined);
  const reorderLock = useRef(false);
  const reorderHelpId = `factory-menu-reorder-${useId()}`;
  const reorderDisabled = reordering || !!search.trim();
  useEffect(() => {
    let active = true;
    Promise.all([client.list(), client.categories()])
      .then(([items, categories]) => {
        if (active) {
          setData({
            items: [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
            categories,
          });
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, revision]);
  async function moveItem(id: string, targetId: string) {
    if (!data || !client.reorder || reorderLock.current || search.trim() || id === targetId) return;
    const from = data.items.findIndex((item) => item.id === id);
    const to = data.items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const ordered = [...data.items];
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    reorderLock.current = true;
    setReordering(true);
    setOrderFeedback(undefined);
    try {
      const items = await client.reorder(ordered.map(({ id, version }) => ({ id, version })));
      setData((current) => (current ? { ...current, items } : current));
      setOrderFeedback("saved");
    } catch {
      setOrderFeedback("error");
      setRevision((value) => value + 1);
    } finally {
      reorderLock.current = false;
      setReordering(false);
    }
  }
  const categoryNames = new Map(
    data?.categories.map((category) => [category.id, category.translations[baseLocale]]) ?? [],
  );
  const filteredItems =
    data?.items.filter((item) =>
      matchesTableSearch(
        search,
        item.translations[baseLocale]?.name,
        categoryNames.get(item.categoryId),
        item.visible ? labels.yes : labels.no,
        item.soldOut ? labels.yes : labels.no,
      ),
    ) ?? [];
  return (
    <section className={cn(page, className)}>
      <div className={tablePanelClass}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold">{labels.items}</h1>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <HostLink href={taxonomyHref} className={outlineButton}>
              <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.categories} / {labels.labels}
            </HostLink>
            <TableSearch
              value={search}
              onValueChange={setSearch}
              label={labels.search}
              clearLabel={labels.clearSearch}
            />
            <HostLink href={newHref} className={primary}>
              <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
              {labels.newItem}
            </HostLink>
          </div>
        </header>
        {client.reorder && (
          <p id={reorderHelpId} className="mt-3 text-sm text-muted-foreground">
            {search.trim() ? labels.reorderSearchHelp : labels.reorderHelp}
          </p>
        )}
        {reordering ? <output className="block text-sm">{labels.saving}</output> : null}
        {orderFeedback === "saved" ? (
          <output className="block text-sm">{labels.saved}</output>
        ) : null}
        {orderFeedback === "error" ? <ErrorMessage message={labels.error} /> : null}
        {error ? (
          <div>
            <ErrorMessage message={labels.error} />
            <button className={button} onClick={() => setRevision((n) => n + 1)}>
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.retry}
            </button>
          </div>
        ) : null}
        {!data && !error ? <output>{labels.loading}</output> : null}
        {data?.items.length === 0 ? <p>{labels.emptyItems}</p> : null}
        {data?.items.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={tableRowClass}>
                  <th scope="col" className={tableHeaderClass}>
                    {labels.name}
                  </th>
                  <th scope="col" className={tableHeaderClass}>
                    {labels.category}
                  </th>
                  <th scope="col" className={tableHeaderClass}>
                    {labels.visible}
                  </th>
                  <th scope="col" className={tableHeaderClass}>
                    {labels.unavailable}
                  </th>
                  <th scope="col" className={tableActionCellClass}>
                    {labels.editItem}
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    data-menu-item={item.id}
                    className={cn(
                      tableRowClass,
                      dragTarget === item.id &&
                        "bg-accent text-accent-foreground ring-2 ring-ring ring-inset",
                    )}
                  >
                    <td className={cn(tableCellClass, "font-medium")}>
                      <div className="flex items-center gap-2">
                        {client.reorder && (
                          <button
                            type="button"
                            className={cn(iconButton, "touch-none")}
                            aria-label={`${labels.reorder}: ${item.translations[baseLocale]?.name}`}
                            aria-describedby={reorderHelpId}
                            aria-disabled={reorderDisabled}
                            onPointerDown={(event) => {
                              if (
                                reorderDisabled ||
                                reorderLock.current ||
                                event.button !== 0 ||
                                !event.isPrimary
                              )
                                return;
                              event.currentTarget.setPointerCapture(event.pointerId);
                              drag.current = { id: item.id, targetId: item.id };
                              setDragTarget(item.id);
                            }}
                            onPointerMove={(event) => {
                              if (!drag.current) return;
                              const row = document
                                .elementFromPoint(event.clientX, event.clientY)
                                ?.closest<HTMLTableRowElement>("tr[data-menu-item]");
                              if (row && event.currentTarget.closest("table")?.contains(row)) {
                                drag.current.targetId = row.dataset.menuItem!;
                                setDragTarget(drag.current.targetId);
                              }
                            }}
                            onPointerUp={(event) => {
                              const current = drag.current;
                              drag.current = undefined;
                              setDragTarget(undefined);
                              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                event.currentTarget.releasePointerCapture(event.pointerId);
                              }
                              const target = document.elementFromPoint(
                                event.clientX,
                                event.clientY,
                              );
                              if (
                                current &&
                                target &&
                                event.currentTarget.closest("table")?.contains(target)
                              ) {
                                void moveItem(current.id, current.targetId);
                              }
                            }}
                            onPointerCancel={() => {
                              drag.current = undefined;
                              setDragTarget(undefined);
                            }}
                            onLostPointerCapture={() => {
                              drag.current = undefined;
                              setDragTarget(undefined);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                drag.current = undefined;
                                setDragTarget(undefined);
                              }
                              if (reorderDisabled || !["ArrowUp", "ArrowDown"].includes(event.key))
                                return;
                              event.preventDefault();
                              const index = data.items.findIndex((entry) => entry.id === item.id);
                              const target = data.items[index + (event.key === "ArrowUp" ? -1 : 1)];
                              if (target) void moveItem(item.id, target.id);
                            }}
                          >
                            <GripVerticalIcon className="size-4 shrink-0" aria-hidden="true" />
                          </button>
                        )}
                        {item.translations[baseLocale]?.name}
                      </div>
                    </td>
                    <td className={tableCellClass}>{categoryNames.get(item.categoryId)}</td>
                    <td className={tableCellClass}>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          item.visible
                            ? "bg-status-success text-status-success-foreground"
                            : "bg-status-not-started text-status-not-started-foreground",
                        )}
                      >
                        {item.visible ? labels.yes : labels.no}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          item.soldOut
                            ? "bg-status-pending text-status-pending-foreground"
                            : "bg-status-success text-status-success-foreground",
                        )}
                      >
                        {item.soldOut ? labels.yes : labels.no}
                      </span>
                    </td>
                    <td className={tableActionCellClass}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <HostLink
                          href={getEditHref(item)}
                          className={iconButton}
                          aria-label={`${labels.editItem}: ${item.translations[baseLocale]?.name}`}
                        >
                          <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
                        </HostLink>
                        <DeleteControl
                          label={`${labels.deleteItem}: ${item.translations[baseLocale]?.name}`}
                          confirm={labels.confirmDelete}
                          cancel={labels.cancel}
                          errorMessage={labels.deleteFilesFirst}
                          onDelete={() => client.remove(item.id)}
                          onDone={() => setRevision((n) => n + 1)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr className={tableRowClass}>
                    <td colSpan={5} className={tableCellClass}>
                      {labels.noMatches}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export interface MenuItemEditorPageProps {
  client: MenusClient;
  item?: MenuItem;
  categories: readonly MenuCategory[];
  labelsData: readonly MenuLabel[];
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  currency: string;
  backHref: string;
  onSaved: (item: MenuItem) => void;
  driveClient?: DriveClient;
  driveTransfer?: DriveTransfer;
  photoFolderId?: string | null;
  getFolderHref?: (folderId: string | null) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuItemEditorPage({
  client,
  item,
  categories,
  labelsData,
  locales,
  baseLocale,
  currency,
  backHref,
  onSaved,
  driveClient,
  driveTransfer,
  photoFolderId,
  getFolderHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuItemEditorPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [draft, setDraft] = useState<MenuItemInput>(() =>
    item
      ? {
          categoryId: item.categoryId,
          priceMinor: item.priceMinor,
          position: item.position,
          visible: item.visible,
          soldOut: item.soldOut,
          spiceLevel: item.spiceLevel ?? 0,
          imageEntryId: item.imageEntryId,
          labelIds: [...item.labelIds],
          translations: { ...item.translations },
        }
      : {
          categoryId: categories[0]?.id ?? "",
          priceMinor: 0,
          position: 0,
          visible: false,
          soldOut: false,
          spiceLevel: 0,
          imageEntryId: null,
          labelIds: [],
          translations: { [baseLocale]: { name: "", description: "" } },
        },
  );
  const [selectedLocale, setSelectedLocale] = useState(baseLocale);
  const sortedLabels = [...labelsData].sort((a, b) =>
    a.translations[baseLocale].localeCompare(b.translations[baseLocale], baseLocale, {
      sensitivity: "base",
    }),
  );
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [photoName, setPhotoName] = useState("");
  const [savedVersion, setSavedVersion] = useState(item?.version);
  const lock = useRef(false);
  const formatter = new Intl.NumberFormat(baseLocale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const [price, setPrice] = useState((draft.priceMinor / 10 ** digits).toFixed(digits));
  const [sizes, setSizes] = useState(() =>
    (item?.sizes ?? []).map((size) => ({
      id: size.id,
      price: (size.priceMinor / 10 ** digits).toFixed(digits),
      translations: { ...size.translations },
    })),
  );
  const updateTranslation = (locale: string, patch: Partial<MenuItem["translations"][string]>) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...(current.translations[locale] ?? { name: "", description: "" }), ...patch },
      },
    }));
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFeedback(undefined);
    try {
      if (!draft.translations[baseLocale]?.name.trim()) {
        setSelectedLocale(baseLocale);
        setFeedback({ error: true, text: labels.baseNameRequired });
        return;
      }
      if (sizes.some((size) => !size.translations[baseLocale]?.trim())) {
        setSelectedLocale(baseLocale);
        setFeedback({ error: true, text: labels.baseSizeNameRequired });
        return;
      }
      const sizePrices = sizes.map((size) => ({
        id: size.id,
        priceMinor: parsePrice(size.price, digits),
        translations: size.translations,
      }));
      const input = {
        ...draft,
        priceMinor: sizePrices[0]?.priceMinor ?? parsePrice(price, digits),
        sizes: sizePrices,
      };
      const saved = item
        ? await client.save(item.id, savedVersion ?? item.version, input)
        : await client.create(input);
      setSavedVersion(saved.version);
      setFeedback({ error: false, text: labels.saved });
      onSaved(saved);
    } catch {
      setFeedback({ error: true, text: labels.error });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <section className={cn(page, className)}>
      <HostLink href={backHref} className={button}>
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">{item ? labels.editItem : labels.newItem}</h1>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span>{labels.category}</span>
            <select
              className={field}
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.translations[baseLocale]}
                </option>
              ))}
            </select>
          </label>
          {sizes.length === 0 ? (
            <label className="space-y-1">
              <span>
                {labels.price} ({currency})
              </span>
              <input
                className={field}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </label>
          ) : null}
        </div>
        <Tabs.Root
          value={selectedLocale}
          onValueChange={(value) => setSelectedLocale(value as string)}
        >
          <Tabs.List
            aria-label={labels.language}
            className="flex gap-1 overflow-x-auto border-b border-border"
          >
            {editorLocales(locales, baseLocale).map((locale) => (
              <Tabs.Tab
                key={locale.code}
                type="button"
                value={locale.code}
                className="min-h-11 shrink-0 cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground focus-visible:rounded-t-md focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed data-[active]:border-primary data-[active]:text-foreground"
              >
                {locale.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {editorLocales(locales, baseLocale).map((locale) => {
            const translation = draft.translations[locale.code] ?? { name: "", description: "" };
            return (
              <Tabs.Panel key={locale.code} value={locale.code} className="space-y-4 pt-4">
                <label className="block space-y-1">
                  <span>
                    {labels.name}
                    {locale.code === baseLocale ? " *" : ""}
                  </span>
                  <input
                    className={field}
                    value={translation.name}
                    onChange={(event) =>
                      updateTranslation(locale.code, { name: event.target.value })
                    }
                    maxLength={200}
                    required={locale.code === baseLocale}
                  />
                </label>
                <label className="block space-y-1">
                  <span>{labels.description}</span>
                  <textarea
                    className={field}
                    rows={4}
                    value={translation.description}
                    onChange={(event) =>
                      updateTranslation(locale.code, { description: event.target.value })
                    }
                    maxLength={2000}
                  />
                </label>
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-medium">{labels.sizes}</legend>
          <p className="text-sm text-muted-foreground">{labels.sizeHelp}</p>
          {sizes.map((size, index) => (
            <div key={size.id} className="flex items-end gap-2 rounded-xl border border-border p-3">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 space-y-1">
                  <span>
                    {labels.sizeName} ({selectedLocale}) {index + 1}
                  </span>
                  <input
                    className={field}
                    value={size.translations[selectedLocale] ?? ""}
                    maxLength={120}
                    onChange={(event) =>
                      setSizes((current) =>
                        current.map((entry) =>
                          entry.id === size.id
                            ? {
                                ...entry,
                                translations: {
                                  ...entry.translations,
                                  [selectedLocale]: event.target.value,
                                },
                              }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span>
                    {labels.price} ({currency}) {index + 1}
                  </span>
                  <input
                    className={field}
                    inputMode="decimal"
                    value={size.price}
                    required
                    onChange={(event) =>
                      setSizes((current) =>
                        current.map((entry) =>
                          entry.id === size.id ? { ...entry, price: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <DeleteControl
                label={`${labels.removeSize}: ${size.translations[baseLocale] || index + 1}`}
                confirm={labels.confirmDelete}
                cancel={labels.cancel}
                errorMessage={labels.error}
                onDelete={async () => {}}
                onDone={() =>
                  setSizes((current) => current.filter((entry) => entry.id !== size.id))
                }
              />
            </div>
          ))}
          <button
            type="button"
            className={outlineButton}
            disabled={sizes.length >= 20}
            onClick={() =>
              setSizes((current) => [
                ...current,
                { id: crypto.randomUUID(), price, translations: { [baseLocale]: "" } },
              ])
            }
          >
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
            {labels.addSize}
          </button>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium">{labels.spiceLevel}</legend>
          <div className="flex flex-wrap gap-2">
            {([0, 1, 2, 3] as const).map((level) => (
              <label
                key={level}
                className={cn(
                  "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2",
                  draft.spiceLevel === level && "ring-2 ring-ring",
                )}
              >
                <input
                  type="radio"
                  name="spiceLevel"
                  value={level}
                  checked={draft.spiceLevel === level}
                  className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={() => setDraft((current) => ({ ...current, spiceLevel: level }))}
                />
                {level === 0 ? labels.notSpicy : <MenuSpiceBadge level={level} labels={labels} />}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium">{labels.labels}</legend>
          <div className="flex flex-wrap gap-4">
            {sortedLabels.map((label) => (
              <label key={label.id} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.labelIds.includes(label.id)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      labelIds: event.target.checked
                        ? [...current.labelIds, label.id]
                        : current.labelIds.filter((id) => id !== label.id),
                    }))
                  }
                />
                <MenuLabelBadge label={{ ...label, name: label.translations[baseLocale] }} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-5">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(event) => setDraft({ ...draft, visible: event.target.checked })}
              disabled={!item}
            />
            {labels.visible}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.soldOut}
              onChange={(event) => setDraft({ ...draft, soldOut: event.target.checked })}
            />
            {labels.unavailable}
          </label>
        </div>
        {draft.imageEntryId ? (
          <div className="flex items-center gap-3 text-sm">
            <span>
              {labels.photo}: {photoName || draft.imageEntryId}
            </span>
            <button
              type="button"
              className={button}
              onClick={() => setDraft({ ...draft, imageEntryId: null })}
            >
              {labels.removePhoto}
            </button>
          </div>
        ) : null}
        {feedback ? (
          <p
            role={feedback.error ? "alert" : "status"}
            className={feedback.error ? "text-destructive" : "text-muted-foreground"}
          >
            {feedback.text}
          </p>
        ) : null}
        <button type="submit" className={primary} disabled={pending || !categories.length}>
          {pending ? labels.saving : labels.save}
        </button>
      </form>
      {item && driveClient && getFolderHref ? (
        <div className="border-t border-border pt-6">
          <h2 className="mb-4 text-xl font-semibold">{labels.photo}</h2>
          <DriveBrowser
            client={driveClient}
            transferUpload={driveTransfer}
            scope={{ type: "menu-item", id: item.id }}
            parentId={photoFolderId}
            getFolderHref={getFolderHref}
            linkComponent={HostLink}
            onSelectFile={(entry) => {
              setDraft({ ...draft, imageEntryId: entry.id });
              setPhotoName(entry.name);
            }}
            isSelectableFile={(entry: DriveEntry) =>
              ["image/jpeg", "image/png", "image/webp"].includes(entry.contentType) &&
              entry.size <= 10_000_000
            }
            selectFileLabel={labels.selectPhoto}
            uploadAccept="image/jpeg,image/png,image/webp"
          />
        </div>
      ) : null}
    </section>
  );
}

export interface MenuTaxonomyPageProps {
  client: MenusClient;
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

function TaxonomyDialog({
  kind,
  existing,
  locales,
  baseLocale,
  labels,
  onSave,
}: {
  kind: "category" | "label";
  existing?: MenuCategory | MenuLabel;
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  labels: MenusLabels;
  onSave: (data: {
    id?: string;
    position: number;
    translations: Record<string, string>;
    kind?: MenuLabel["kind"];
    icon?: MenuLabelIcon | null;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(existing?.position ?? 0);
  const [translations, setTranslations] = useState<Record<string, string>>(
    existing?.translations ?? {},
  );
  const [labelKind, setLabelKind] = useState<MenuLabel["kind"]>(
    existing && "kind" in existing ? existing.kind : "allergen",
  );
  const [icon, setIcon] = useState<MenuLabelIcon | null>(
    existing && "kind" in existing ? (existing.icon ?? null) : null,
  );
  const iconNames = { ...menusLabels.iconNames, ...labels.iconNames };
  const title =
    kind === "category"
      ? existing
        ? labels.editCategory
        : labels.newCategory
      : existing
        ? labels.editLabel
        : labels.newLabel;
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <Dialog.Trigger className={existing ? iconButton : primary} aria-label={title}>
        {existing ? (
          <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <>
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
            {title}
          </>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setError(false);
              void onSave({
                id: existing?.id,
                position,
                translations,
                ...(kind === "label" ? { kind: labelKind, icon } : {}),
              })
                .then(() => setOpen(false))
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            {editorLocales(locales, baseLocale).map((locale) => (
              <label key={locale.code} className="block space-y-1">
                <span>
                  {labels.name} ({locale.name}){locale.code === baseLocale ? " *" : ""}
                </span>
                <input
                  className={field}
                  value={translations[locale.code] ?? ""}
                  onChange={(event) =>
                    setTranslations({ ...translations, [locale.code]: event.target.value })
                  }
                  required={locale.code === baseLocale}
                  maxLength={120}
                />
              </label>
            ))}
            <label className="block space-y-1">
              <span>{labels.position}</span>
              <input
                className={field}
                type="number"
                min="0"
                step="1"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                required
              />
            </label>
            {kind === "label" ? (
              <>
                <label className="block space-y-1">
                  <span>{labels.labelKind}</span>
                  <select
                    className={field}
                    value={labelKind}
                    onChange={(event) => setLabelKind(event.target.value as MenuLabel["kind"])}
                  >
                    <option value="allergen">{labels.allergens}</option>
                    <option value="dietary">{labels.dietary}</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span>{labels.icon}</span>
                  <span className="flex items-center gap-3">
                    <MenuLabelSymbol
                      label={{
                        id: existing?.id ?? "",
                        name: translations[baseLocale] ?? "",
                        kind: labelKind,
                        icon,
                      }}
                    />
                    <select
                      className={field}
                      value={icon ?? ""}
                      onChange={(event) =>
                        setIcon((event.target.value || null) as MenuLabelIcon | null)
                      }
                    >
                      <option value="">{labels.automaticIcon}</option>
                      {[...menuLabelIcons]
                        .sort((a, b) => iconNames[a].localeCompare(iconNames[b], baseLocale))
                        .map((value) => (
                          <option key={value} value={value}>
                            {iconNames[value]}
                          </option>
                        ))}
                    </select>
                  </span>
                </label>
              </>
            ) : null}
            {error ? <ErrorMessage message={labels.error} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close className={outlineButton} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button className={primary} disabled={pending}>
                {pending ? labels.saving : labels.save}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MenuTaxonomyPage({
  client,
  locales,
  baseLocale,
  backHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuTaxonomyPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ categories: MenuCategory[]; labelsData: MenuLabel[] }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([client.categories(), client.labels()])
      .then(([categories, labelsData]) => {
        if (active) {
          setData({ categories, labelsData });
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, revision]);
  const refresh = () => setRevision((n) => n + 1);
  return (
    <section className={cn(page, className)}>
      <HostLink href={backHref} className={button}>
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">
        {labels.categories} / {labels.labels}
      </h1>
      {error ? (
        <div>
          <ErrorMessage message={labels.error} />
          <button className={button} onClick={refresh}>
            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.retry}
          </button>
        </div>
      ) : null}
      {!data && !error ? <output>{labels.loading}</output> : null}
      {data ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{labels.categories}</h2>
              <TaxonomyDialog
                key="new-category"
                kind="category"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await client.saveCategory({
                    position: input.position,
                    translations: input.translations,
                  });
                  refresh();
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {data.categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between p-3">
                  <span>{category.translations[baseLocale]}</span>
                  <div className="flex gap-2">
                    <TaxonomyDialog
                      key={category.id}
                      kind="category"
                      existing={category}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await client.saveCategory({
                          id: category.id,
                          position: input.position,
                          translations: input.translations,
                        });
                        refresh();
                      }}
                    />
                    <DeleteControl
                      label={`${labels.deleteCategory}: ${category.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      errorMessage={labels.error}
                      onDelete={() => client.removeCategory(category.id)}
                      onDone={refresh}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{labels.labels}</h2>
              <TaxonomyDialog
                key="new-label"
                kind="label"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await client.saveLabel({
                    kind: input.kind ?? "allergen",
                    icon: input.icon,
                    position: input.position,
                    translations: input.translations,
                  });
                  refresh();
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {data.labelsData.map((label) => (
                <li key={label.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <MenuLabelSymbol label={{ ...label, name: label.translations[baseLocale] }} />
                    <span className="min-w-0 wrap-anywhere">
                      {label.translations[baseLocale]}{" "}
                      <span className="text-xs text-muted-foreground">({label.kind})</span>
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <TaxonomyDialog
                      key={label.id}
                      kind="label"
                      existing={label}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await client.saveLabel({
                          id: label.id,
                          kind: input.kind ?? label.kind,
                          icon: input.icon,
                          position: input.position,
                          translations: input.translations,
                        });
                        refresh();
                      }}
                    />
                    <DeleteControl
                      label={`${labels.deleteLabel}: ${label.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      errorMessage={labels.error}
                      onDelete={() => client.removeLabel(label.id)}
                      onDone={refresh}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
