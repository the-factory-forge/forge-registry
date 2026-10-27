"use client";

import {
  ArrowLeftIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { useActionToast, ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import {
  MenuTaxonomyEditor,
  type MenuItemEditorPageProps,
} from "@/components/plugins/menus/editor";
import { MenuLabelSymbol } from "@/components/plugins/menus/label-badge";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import type { MenuItem, MenusClient } from "@/components/plugins/menus/types";
import {
  button,
  outlineButton,
  primary,
  page,
  iconButton,
  ErrorMessage,
  DeleteControl,
} from "@/components/plugins/menus/ui";
import { useMenuCategoriesAndLabels } from "@/components/plugins/menus/use-categories-and-labels";
import { useMenuItems } from "@/components/plugins/menus/use-menu-items";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import {
  TableBulkDelete,
  TableSelectionCheckbox,
  useTableSelection,
} from "@/components/table-selection";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems } from "@/components/utils/use-optimistic-action";
export {
  MenuItemEditorPage,
  type MenuItemEditorPageProps,
} from "@/components/plugins/menus/editor";

export interface MenuItemsPageProps {
  /** Keep stable while editing; replacing the client starts a fresh item list. */
  client: MenusClient;
  baseLocale: string;
  newHref: string;
  taxonomyHref: string;
  printHref?: string;
  getEditHref: (item: MenuItem) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

function MenuItemsPageContent({
  client,
  baseLocale,
  newHref,
  taxonomyHref,
  printHref,
  getEditHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuItemsPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [search, setSearch] = useState("");
  const items = useMenuItems(client);
  const { data, source: savedData, loading, error, reordering } = items;
  const notify = useActionToast();
  const [preview, setDragPreview] = useState<{
    scope: number;
    id: string;
    x: number;
    y: number;
    targetId?: string;
    edge?: "before" | "after";
    container: HTMLElement;
  }>();
  const dragPreview = preview?.scope === items.scope ? preview : undefined;
  const drag = useRef<
    | {
        scope: number;
        id: string;
        pointerId: number;
        startX: number;
        startY: number;
        active: boolean;
        to?: number;
      }
    | undefined
  >(undefined);
  const reorderHelpId = `factory-menu-reorder-${useId()}`;
  useEffect(() => {
    drag.current = undefined;
  }, [items.scope]);
  function clearDrag() {
    drag.current = undefined;
    setDragPreview(undefined);
  }
  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || !data) return;
    if (current.scope !== items.scope) {
      clearDrag();
      return;
    }
    if (
      !current.active &&
      Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6
    )
      return;
    current.active = true;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLTableRowElement>("tr[data-menu-item]");
    const from = data.items.findIndex((item) => item.id === current.id);
    let targetId: string | undefined;
    let edge: "before" | "after" | undefined;
    current.to = undefined;
    if (row && event.currentTarget.closest("table")?.contains(row)) {
      const target = data.items.findIndex((item) => item.id === row.dataset.menuItem);
      const bounds = row.getBoundingClientRect();
      const after = event.clientY >= bounds.top + bounds.height / 2;
      const to = target - (target > from ? 1 : 0) + (after ? 1 : 0);
      if (target >= 0 && target !== from && to !== from) {
        current.to = to;
        targetId = row.dataset.menuItem;
        edge = after ? "after" : "before";
      }
    }
    setDragPreview({
      scope: items.scope,
      id: current.id,
      x: Math.max(16, Math.min(event.clientX + 16, window.innerWidth - 304)),
      y: Math.max(16, Math.min(event.clientY - 80, window.innerHeight - 96)),
      targetId,
      edge,
      container: document.body,
    });
  }
  async function moveItem(id: string, to: number) {
    if (!reorderDisabled && (await items.move(id, to))) notify(labels.saved);
  }
  const categoryNames = new Map(
    data?.categories.map((category) => [category.id, category.translations[baseLocale]]) ?? [],
  );
  const draggedItem = data?.items.find((item) => item.id === dragPreview?.id);
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
  const selectable = filteredItems;
  const selection = useTableSelection(selectable, JSON.stringify([items.scope, search]));
  const selectionDisabled = loading || error || reordering || items.pending || selection.pending;
  const reorderDisabled = selectionDisabled || !!search.trim();
  return (
    <section className={cn(page, className)}>
      <div className={tablePanelClass}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold">{labels.items}</h1>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <TableSearch
              value={search}
              onValueChange={setSearch}
              label={labels.search}
              clearLabel={labels.clearSearch}
            />
            <HostLink href={taxonomyHref} className={outlineButton}>
              <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.categories} / {labels.labels}
            </HostLink>
            {printHref && (
              <HostLink href={printHref} className={outlineButton}>
                <PrinterIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.printMenu}
              </HostLink>
            )}
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
        {items.mutationError ? <ErrorMessage message={labels.error} /> : null}
        <div className="mt-5 overflow-x-auto">
          <table className={tableClass} aria-busy={loading || reordering}>
            {loading && filteredItems.length > 0 && (
              <caption className="sr-only">
                <output>{labels.loading}</output>
              </caption>
            )}
            <thead>
              <tr className={tableRowClass}>
                <th scope="col" className="w-10 p-2">
                  <TableSelectionCheckbox
                    label={labels.selectAllRows}
                    checked={selection.all}
                    mixed={selection.mixed}
                    onChange={selection.toggleAll}
                    disabled={selectionDisabled || !selectable.length}
                  />
                </th>
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
                <th scope="col" className={tableActionHeaderClass}>
                  <div className="flex items-center justify-end gap-2">
                    {labels.actions}
                    <TableBulkDelete
                      selection={selection}
                      getName={(item) => item.translations[baseLocale]?.name ?? item.id}
                      onDelete={(item) => items.removeSelected(item.id)}
                      labels={labels}
                      disabled={selectionDisabled}
                      errorMessage={() => labels.deleteFilesFirst}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {retainRemovedItems(filteredItems, savedData?.items ?? [], items.pending).map(
                (item) => (
                  <tr
                    key={`${items.scope}:${item.id}`}
                    hidden={
                      selection.isDeleting(item.id) ||
                      !filteredItems.some((row) => row.id === item.id)
                    }
                    data-menu-item={item.id}
                    data-menu-dragging={dragPreview?.id === item.id || undefined}
                    data-menu-drop-edge={
                      dragPreview?.targetId === item.id ? dragPreview.edge : undefined
                    }
                    className={cn(
                      tableRowClass,
                      dragPreview?.id === item.id && "opacity-40",
                      dragPreview?.targetId === item.id &&
                        (dragPreview.edge === "before"
                          ? "[&>td]:shadow-[inset_0_2px_0_var(--primary)]"
                          : "[&>td]:shadow-[inset_0_-2px_0_var(--primary)]"),
                    )}
                  >
                    <td className="w-10 p-2">
                      <TableSelectionCheckbox
                        label={`${labels.selectRow}: ${item.translations[baseLocale]?.name ?? item.id}`}
                        checked={selection.selected.some((row) => row.id === item.id)}
                        mixed={false}
                        onChange={(checked) => selection.toggle(item.id, checked)}
                        disabled={selectionDisabled}
                      />
                    </td>
                    <td className={cn(tableCellClass, "font-medium")}>
                      <div className="flex items-center gap-2">
                        {client.reorder && (
                          <IconTooltip
                            label={`${labels.reorder}: ${item.translations[baseLocale]?.name}`}
                          >
                            <button
                              type="button"
                              className={cn(iconButton, "touch-none")}
                              aria-label={`${labels.reorder}: ${item.translations[baseLocale]?.name}`}
                              aria-describedby={reorderHelpId}
                              aria-disabled={reorderDisabled}
                              onPointerDown={(event) => {
                                if (reorderDisabled || event.button !== 0 || !event.isPrimary)
                                  return;
                                event.currentTarget.setPointerCapture(event.pointerId);
                                event.currentTarget.focus({ preventScroll: true });
                                drag.current = {
                                  scope: items.scope,
                                  id: item.id,
                                  pointerId: event.pointerId,
                                  startX: event.clientX,
                                  startY: event.clientY,
                                  active: false,
                                };
                              }}
                              onPointerMove={updateDrag}
                              onPointerUp={(event) => {
                                updateDrag(event);
                                const current = drag.current;
                                clearDrag();
                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                  event.currentTarget.releasePointerCapture(event.pointerId);
                                }
                                if (current?.to !== undefined) {
                                  void moveItem(current.id, current.to);
                                }
                              }}
                              onPointerCancel={clearDrag}
                              onLostPointerCapture={clearDrag}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  const current = drag.current;
                                  clearDrag();
                                  if (
                                    current &&
                                    event.currentTarget.hasPointerCapture(current.pointerId)
                                  ) {
                                    event.currentTarget.releasePointerCapture(current.pointerId);
                                  }
                                }
                                if (
                                  drag.current ||
                                  reorderDisabled ||
                                  !["ArrowUp", "ArrowDown"].includes(event.key)
                                )
                                  return;
                                event.preventDefault();
                                const index = filteredItems.findIndex(
                                  (entry) => entry.id === item.id,
                                );
                                void moveItem(item.id, index + (event.key === "ArrowUp" ? -1 : 1));
                              }}
                            >
                              <GripVerticalIcon className="size-4 shrink-0" aria-hidden="true" />
                            </button>
                          </IconTooltip>
                        )}
                        {item.translations[baseLocale]?.name}
                      </div>
                    </td>
                    <td className={tableCellClass}>{categoryNames.get(item.categoryId)}</td>
                    <td className={tableCellClass}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
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
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
                          item.soldOut
                            ? "bg-status-pending text-status-pending-foreground"
                            : "bg-status-success text-status-success-foreground",
                        )}
                      >
                        {item.soldOut ? labels.yes : labels.no}
                      </span>
                    </td>
                    <td className={tableActionCellClass}>
                      <div className={tableActionsClass}>
                        <IconTooltip
                          label={`${labels.editItem}: ${item.translations[baseLocale]?.name}`}
                        >
                          <HostLink
                            href={getEditHref(item)}
                            className={iconButton}
                            aria-label={`${labels.editItem}: ${item.translations[baseLocale]?.name}`}
                          >
                            <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
                          </HostLink>
                        </IconTooltip>
                        <DeleteControl
                          disabled={selectionDisabled}
                          label={`${labels.deleteItem}: ${item.translations[baseLocale]?.name}`}
                          confirm={labels.confirmDelete}
                          cancel={labels.cancel}
                          closeLabel={labels.close}
                          errorMessage={labels.deleteFilesFirst}
                          onDelete={() => items.remove(item.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {(error || filteredItems.length === 0) && (
                <tr className={tableRowClass}>
                  <td colSpan={6} className={cn(tableCellClass, "py-8")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {error ? (
                        <>
                          <ErrorMessage message={labels.error} />
                          <button
                            type="button"
                            className={button}
                            onClick={items.refresh}
                            disabled={items.pending || selection.pending}
                          >
                            <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                            {labels.retry}
                          </button>
                        </>
                      ) : (
                        <output className="text-muted-foreground">
                          {loading
                            ? labels.loading
                            : search.trim()
                              ? labels.noMatches
                              : labels.emptyItems}
                        </output>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {dragPreview &&
        draggedItem &&
        createPortal(
          <div
            data-menu-drag-preview
            aria-hidden="true"
            className="pointer-events-none fixed z-50 flex w-72 max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground shadow-lg select-none dark:shadow-none dark:ring-1 dark:ring-border"
            style={{
              left: dragPreview.x,
              top: dragPreview.y,
            }}
          >
            <GripVerticalIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 text-sm">
              <p className="line-clamp-2 font-medium break-words">
                {draggedItem.translations[baseLocale]?.name}
              </p>
              <p className="truncate text-muted-foreground">
                {categoryNames.get(draggedItem.categoryId)}
              </p>
            </div>
          </div>,
          dragPreview.container,
        )}
    </section>
  );
}

export interface MenuTaxonomyPageProps {
  blockedNavigation?: MenuItemEditorPageProps["blockedNavigation"];
  onNavigationStateChange?: MenuItemEditorPageProps["onNavigationStateChange"];
  /** Keep stable while editing; replacing the client starts a new taxonomy session. */
  client: MenusClient;
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

function MenuTaxonomyPageContent({
  client,
  locales,
  baseLocale,
  backHref,
  blockedNavigation,
  onNavigationStateChange,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuTaxonomyPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const taxonomy = useMenuCategoriesAndLabels(client);
  const { data, source: savedData, error, refresh } = taxonomy;
  const disabled = taxonomy.loading || taxonomy.pending;
  return (
    <section className={cn(page, className)}>
      <HostLink href={backHref} className={cn(button, "hover:bg-primary/5 hover:text-primary")}>
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">
        {labels.categories} / {labels.labels}
      </h1>
      <ErrorMessage message={taxonomy.mutationError ? labels.error : undefined} />
      {error ? (
        <div>
          <ErrorMessage message={labels.error} />
          <button
            className={button}
            onClick={refresh}
            disabled={taxonomy.pending || taxonomy.loading}
          >
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
              <MenuTaxonomyEditor
                blockedNavigation={blockedNavigation}
                onNavigationStateChange={onNavigationStateChange}
                disabled={disabled}
                key="new-category"
                kind="category"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await taxonomy.saveCategory({
                    position: input.position,
                    translations: input.translations,
                  });
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {retainRemovedItems(
                data.categories,
                savedData?.categories ?? [],
                taxonomy.pending,
              ).map((category) => (
                <li
                  key={category.id}
                  hidden={!data.categories.some((row) => row.id === category.id)}
                  className="flex items-center justify-between p-3"
                >
                  <span>{category.translations[baseLocale]}</span>
                  <div className="flex gap-2">
                    <MenuTaxonomyEditor
                      blockedNavigation={blockedNavigation}
                      onNavigationStateChange={onNavigationStateChange}
                      disabled={disabled}
                      key={category.id}
                      kind="category"
                      existing={category}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await taxonomy.saveCategory({
                          id: category.id,
                          position: input.position,
                          translations: input.translations,
                        });
                      }}
                    />
                    <DeleteControl
                      disabled={disabled}
                      label={`${labels.deleteCategory}: ${category.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      closeLabel={labels.close}
                      errorMessage={labels.error}
                      onDelete={() => taxonomy.removeCategory(category.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{labels.labels}</h2>
              <MenuTaxonomyEditor
                blockedNavigation={blockedNavigation}
                onNavigationStateChange={onNavigationStateChange}
                disabled={disabled}
                key="new-label"
                kind="label"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await taxonomy.saveLabel({
                    kind: input.kind ?? "allergen",
                    icon: input.icon,
                    position: input.position,
                    translations: input.translations,
                  });
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {retainRemovedItems(
                data.labelsData,
                savedData?.labelsData ?? [],
                taxonomy.pending,
              ).map((label) => (
                <li
                  key={label.id}
                  hidden={!data.labelsData.some((row) => row.id === label.id)}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MenuLabelSymbol label={{ ...label, name: label.translations[baseLocale] }} />
                    <span className="min-w-0 wrap-anywhere">
                      {label.translations[baseLocale]}{" "}
                      <span className="text-xs text-muted-foreground">({label.kind})</span>
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <MenuTaxonomyEditor
                      blockedNavigation={blockedNavigation}
                      onNavigationStateChange={onNavigationStateChange}
                      disabled={disabled}
                      key={label.id}
                      kind="label"
                      existing={label}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await taxonomy.saveLabel({
                          id: label.id,
                          kind: input.kind ?? label.kind,
                          icon: input.icon,
                          position: input.position,
                          translations: input.translations,
                        });
                      }}
                    />
                    <DeleteControl
                      disabled={disabled}
                      label={`${labels.deleteLabel}: ${label.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      closeLabel={labels.close}
                      errorMessage={labels.error}
                      onDelete={() => taxonomy.removeLabel(label.id)}
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

export function MenuTaxonomyPage(props: MenuTaxonomyPageProps) {
  const [session, setSession] = useState({ client: props.client, key: 0 });
  if (session.client !== props.client) setSession({ client: props.client, key: session.key + 1 });
  return <MenuTaxonomyPageContent key={session.key} {...props} />;
}

export function MenuItemsPage(props: MenuItemsPageProps) {
  return (
    <ActionToastProvider>
      <MenuItemsPageContent {...props} />
    </ActionToastProvider>
  );
}
